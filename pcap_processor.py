#!/usr/bin/env python3
"""
pcap_processor.py
Processes raw .pcap and .pcapng files (such as CIC-IoT, CTU-13, or real attack captures)
and transforms network flows/alerts into the graph schema required by Reverse Attack-Path Viz.
"""

import sys
import json
import os
import ipaddress
from collections import defaultdict
import scapy.all as scapy

# Well-known attack ports & services mapping to MITRE ATT&CK stages
PORT_MAPPING = {
    # Initial Access / Recon
    21:  ("FTP Scan/Access", "Initial Access", "network_endpoint", 0.65),
    22:  ("SSH Bruteforce/Access", "Initial Access", "network_endpoint", 0.75),
    23:  ("Telnet Mirai/Exploit", "Initial Access", "network_endpoint", 0.85),
    80:  ("HTTP Web Attack", "Initial Access", "network_endpoint", 0.70),
    443: ("HTTPS C2/Exploit", "Initial Access", "network_endpoint", 0.60),
    8080:("HTTP Proxy/Web Exploit", "Initial Access", "network_endpoint", 0.70),
    
    # Credential Dumping / Auth
    88:  ("Kerberos Auth/Ticket", "Credential Theft", "credential", 0.85),
    389: ("LDAP Recon/Exploit", "Credential Theft", "credential", 0.75),
    636: ("LDAPS Access", "Credential Theft", "credential", 0.75),
    
    # Lateral Movement
    135: ("RPC Endpoint Mapper", "Lateral Movement", "host", 0.80),
    139: ("NetBIOS Session", "Lateral Movement", "host", 0.75),
    445: ("SMB/PsExec Lateral Movement", "Lateral Movement", "host", 0.90),
    3389:("RDP Remote Session", "Lateral Movement", "host", 0.85),
    5985:("WinRM Lateral Exec", "Lateral Movement", "host", 0.85),
    5986:("WinRM HTTPS Lateral Exec", "Lateral Movement", "host", 0.85),
    
    # Discovery / Scanning
    53:  ("DNS Recon/Tunneling", "Initial Access", "network_endpoint", 0.50),
    161: ("SNMP Query", "Initial Access", "network_endpoint", 0.60),
    
    # Impact / C2
    4444:("Metasploit C2 Shell", "Impact", "host", 0.95),
    5555:("ADB Android/IoT Exploit", "Lateral Movement", "network_endpoint", 0.85),
    6667:("IRC Botnet C2", "Impact", "network_endpoint", 0.90),
}

def classify_ip_zone(ip_str):
    """Categorizes IP addresses into Network Zones for the 3D X-axis."""
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_loopback:
            return "Internal"
        
        # Standard RFC 1918 private IP subnets: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
        is_rfc1918 = (
            ip in ipaddress.ip_network("10.0.0.0/8") or
            ip in ipaddress.ip_network("172.16.0.0/12") or
            ip in ipaddress.ip_network("192.168.0.0/16")
        )
        
        if not is_rfc1918:
            return "Internet"
        
        # Categorize private IP blocks into zones
        octets = ip_str.split('.')
        if len(octets) == 4:
            third = int(octets[2])
            if third < 5:
                return "DMZ"
            elif third < 50:
                return "Corp-LAN"
            else:
                return "Server-VLAN"
        return "Internal"
    except Exception:
        return "Internal"

def process_pcap(pcap_path, output_json=None, max_packets=50000, max_edges=150):
    if not os.path.exists(pcap_path):
        raise FileNotFoundError(f"PCAP file not found: {pcap_path}")

    # Use PcapReader for streaming to conserve memory on large PCAPs
    reader = scapy.PcapReader(pcap_path)
    
    flows = defaultdict(lambda: {
        'packet_count': 0,
        'byte_count': 0,
        'first_seen': None,
        'last_seen': None,
        'ports': set(),
        'protocols': set(),
        'tcp_flags': set()
    })
    
    first_global_time = None
    packet_counter = 0

    try:
        for pkt in reader:
            packet_counter += 1
            if packet_counter > max_packets:
                break
            
            if not pkt.haslayer(scapy.IP):
                continue
                
            ip_layer = pkt[scapy.IP]
            src_ip = ip_layer.src
            dst_ip = ip_layer.dst
            ts = float(pkt.time)
            
            if first_global_time is None:
                first_global_time = ts
                
            rel_ts = max(0, ts - first_global_time)
            proto = "IP"
            dport = 0
            sport = 0
            
            if pkt.haslayer(scapy.TCP):
                proto = "TCP"
                sport = pkt[scapy.TCP].sport
                dport = pkt[scapy.TCP].dport
                flags = pkt[scapy.TCP].flags
                flows[(src_ip, dst_ip, dport, proto)]['tcp_flags'].add(str(flags))
            elif pkt.haslayer(scapy.UDP):
                proto = "UDP"
                sport = pkt[scapy.UDP].sport
                dport = pkt[scapy.UDP].dport
            elif pkt.haslayer(scapy.ICMP):
                proto = "ICMP"
                dport = 0
            
            flow_key = (src_ip, dst_ip, dport, proto)
            f = flows[flow_key]
            f['packet_count'] += 1
            f['byte_count'] += len(pkt)
            if f['first_seen'] is None or rel_ts < f['first_seen']:
                f['first_seen'] = rel_ts
            if f['last_seen'] is None or rel_ts > f['last_seen']:
                f['last_seen'] = rel_ts
            f['ports'].add(dport)
            f['protocols'].add(proto)
    finally:
        reader.close()

    if not flows:
        # Fallback empty graph
        result = {
            "name": os.path.basename(pcap_path),
            "nodes": [],
            "edges": []
        }
        if output_json:
            with open(output_json, 'w') as f:
                json.dump(result, f, indent=2)
        return result

    # Sort flows chronologically
    sorted_flows = sorted(flows.items(), key=lambda item: item[1]['first_seen'])

    nodes = {}
    edges = []
    
    # Group flows by canonical endpoints and direction
    # Exclude trivial broadcast/multicast noise (e.g. 255.255.255.255, 224.0.0.0/4, mdns)
    valid_flows = []
    for (src, dst, dport, proto), flow_info in sorted_flows:
        if dst.startswith("224.") or dst.startswith("239.") or dst == "255.255.255.255":
            continue
        valid_flows.append(((src, dst, dport, proto), flow_info))

    if not valid_flows:
        valid_flows = sorted_flows

    nodes = {}
    edges = []
    
    # Track interaction degree to identify root attackers and high-value victim targets
    in_degree = defaultdict(int)
    out_degree = defaultdict(int)

    for (src, dst, dport, proto), flow_info in valid_flows:
        out_degree[src] += flow_info['packet_count']
        in_degree[dst] += flow_info['packet_count']

    # Detect victim / impacted node (highest in-degree target or final high-severity destination)
    potential_targets = sorted(in_degree.items(), key=lambda x: x[1], reverse=True)
    impacted_node_id = potential_targets[0][0] if potential_targets else None

    # Construct nodes and edges with deduplication of bidirectional chatter
    seen_conversations = set()
    edge_id = 0
    for (src, dst, dport, proto), flow_info in valid_flows:
        if len(edges) >= max_edges:
            break

        # Consolidate back-and-forth acknowledgements on the same port
        conv_key = (min(src, dst), max(src, dst), dport, proto)
        if conv_key in seen_conversations:
            continue
        seen_conversations.add(conv_key)

        # Classify activity & MITRE stage
        attack_type, stage, default_node_type, confidence = PORT_MAPPING.get(
            dport, 
            (f"{proto}/{dport}" if dport else proto, "Initial Access", "network_endpoint", 0.50)
        )

        # Detect Port Scanning (single host connecting to many different ports or SYN-only flows)
        if dport not in PORT_MAPPING and len(flow_info['tcp_flags']) == 1 and 'S' in flow_info['tcp_flags'] and flow_info['packet_count'] <= 3:
            attack_type = "Port Scan / Recon"
            stage = "Initial Access"
            confidence = 0.40

        # High volume DDoS / Flood detection
        if flow_info['packet_count'] > 500:
            attack_type = f"{attack_type} (High Volume Flood)"
            stage = "Impact"
            confidence = 0.90

        # Register Source Node
        if src not in nodes:
            src_zone = classify_ip_zone(src)
            is_external = (src_zone == "Internet")
            nodes[src] = {
                "id": src,
                "label": f"Attacker ({src})" if is_external else f"Host ({src})",
                "type": "attacker" if is_external else "host",
                "zone": src_zone,
                "state": "Normal",
                "description": f"IP {src} - Zone: {src_zone} | Sent {out_degree[src]} packets"
            }

        # Register Destination Node
        if dst not in nodes:
            dst_zone = classify_ip_zone(dst)
            nodes[dst] = {
                "id": dst,
                "label": f"Asset ({dst})",
                "type": "network_endpoint" if dst_zone == "DMZ" else "host",
                "zone": dst_zone,
                "state": "Impacted" if dst == impacted_node_id else "Normal",
                "description": f"IP {dst} - Zone: {dst_zone} | Targeted by {in_degree[dst]} packets"
            }

        # Relative timestamp (scaled gracefully for timeline scrubbing, e.g. 0 to 1000s)
        ts_val = int(flow_info['first_seen'])

        edges.append({
            "source": src,
            "target": dst,
            "type": attack_type.lower().replace(" ", "-"),
            "stage": stage,
            "timestamp": ts_val,
            "confidence": round(confidence, 2)
        })
        edge_id += 1

    # Generate detailed scenario intelligence summary
    attackers = [n['id'] for n in nodes.values() if n.get('type') == 'attacker' or n.get('zone') == 'Internet']
    impacted_hosts = [n['id'] for n in nodes.values() if n.get('state') == 'Impacted']
    stages_detected = sorted(list(set(e['stage'] for e in edges if 'stage' in e)))
    attack_types_detected = sorted(list(set(e['type'] for e in edges if 'type' in e)))

    summary_lines = []
    summary_lines.append(f"• Incident Source: {len(attackers)} external/origin IP(s) detected ({', '.join(attackers[:3])}{'...' if len(attackers) > 3 else ''}).")
    if impacted_hosts:
        summary_lines.append(f"• Primary Target Asset: {', '.join(impacted_hosts[:3])} identified as primary target with highest volume of inbound exploitation flows.")
    summary_lines.append(f"• Attack Stages Observed: {' ➔ '.join(stages_detected) if stages_detected else 'Initial Access'}.")
    summary_lines.append(f"• Threat Activities: {', '.join(attack_types_detected[:5])}{'...' if len(attack_types_detected) > 5 else ''}.")
    summary_lines.append(f"• Scope: {len(nodes)} distinct network devices involved across {len(edges)} reconstructed communication flows.")

    detailed_summary = "\n".join(summary_lines)

    scenario_name = os.path.splitext(os.path.basename(pcap_path))[0]
    result = {
        "name": f"PCAP: {scenario_name}",
        "description": detailed_summary,
        "nodes": list(nodes.values()),
        "edges": edges
    }

    if output_json:
        with open(output_json, 'w') as f:
            json.dump(result, f, indent=2)

    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pcap_processor.py <input.pcap> [output.json]")
        sys.exit(1)
        
    pcap_input = sys.argv[1]
    json_output = sys.argv[2] if len(sys.argv) > 2 else "output.json"
    
    res = process_pcap(pcap_input, json_output)
    print(f"Successfully processed {pcap_input} -> {len(res['nodes'])} nodes, {len(res['edges'])} edges generated.")
