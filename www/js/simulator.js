// simulator.js
//
// Generates a controlled ransomware-style attack chain as structured
// security events. This is an EVALUATION FIXTURE (brief section 3, 5) —
// it exists only to produce realistic data for the graph and visualization,
// and is intentionally kept simple so it never competes with the
// visualization/reverse-traversal engine for development effort
// (see "Non-Negotiable Design Principle 6").
//
// Each edge follows: e_i = (src, dst, type, t_i, c_i), c_i in [0,1].

import { STAGE_ORDER } from "./graphStore.js";

const ZONES = ["Internet", "DMZ", "Corp-LAN", "Server-VLAN"];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Builds one ransomware-style attack chain plus some benign "noise" branches
 * so the reverse-traversal engine has more than one candidate path to find.
 *
 * @param {object} opts
 * @param {number} opts.branches how many decoy/alternate origin branches to add
 * @param {number} opts.seed unused placeholder for future deterministic seeding
 */
export function simulateRansomwareIncident({ branches = 2 } = {}) {
  const nodes = [];
  const edges = [];
  let t = 0;
  const nodeId = (() => {
    let n = 0;
    return (prefix) => `${prefix}-${n++}`;
  })();

  function defaultNodeDescription(type, label) {
    const base = {
      attacker: "External threat actor attempting unsolicited access.",
      network_endpoint: "Internet-facing gateway exposed to phishing and remote access attempts.",
      host: "Endpoint system that may host user activity or malware execution.",
      user: "User identity or account involved in credential use and access.",
      credential: "Recovered credential material used for lateral movement or privilege escalation.",
      process: "Execution context or malicious process running on a system.",
      file: "Data asset or file share relevant to storage, encryption, or impact.",
    };
    return base[type] || `${label} is part of the incident chain.`;
  }

  const addNode = (type, zone, label, extra = {}) => {
    const id = nodeId(type);
    const node = { id, type, zone, label, state: "Normal", ...extra };
    node.description ??= defaultNodeDescription(type, label);
    nodes.push(node);
    return id;
  };

  const addEdge = (source, target, type, stage, confidence, dt = rand(20, 240)) => {
    t += dt;
    edges.push({
      source,
      target,
      type,
      stage,
      timestamp: Math.round(t),
      confidence: Math.round(confidence * 100) / 100,
    });
  };

  // --- Core ransomware chain (brief section 5) -----------------------
  const attacker = addNode("attacker", "Internet", "External Attacker");
  const endpoint = addNode("network_endpoint", "DMZ", "VPN Gateway");
  const workstation = addNode("host", "Corp-LAN", "WS-EMP-014");
  const user = addNode("user", "Corp-LAN", "j.alvarez");
  const cred = addNode("credential", "Corp-LAN", "j.alvarez NTLM hash");
  const process1 = addNode("process", "Corp-LAN", "powershell.exe");
  const server = addNode("host", "Server-VLAN", "FILE-SERVER-01");
  const process2 = addNode("process", "Server-VLAN", "svchost.exe (impersonated)");
  const file1 = addNode("file", "Server-VLAN", "\\\\FILE-SERVER-01\\shares\\finance\\*.xlsx");
  const file2 = addNode("file", "Server-VLAN", "\\\\FILE-SERVER-01\\shares\\finance\\*.locked");

  addEdge(attacker, endpoint, "phishing-delivery", "Initial Access", rand(0.55, 0.75));
  addEdge(endpoint, workstation, "malicious-payload-exec", "Initial Access", rand(0.6, 0.85));
  addEdge(workstation, process1, "process-spawn", "Workstation Compromise", rand(0.7, 0.9));
  addEdge(process1, cred, "credential-dump", "Credential Theft", rand(0.65, 0.95));
  addEdge(cred, user, "credential-use", "Credential Theft", rand(0.7, 0.9));
  addEdge(user, server, "smb-logon", "Lateral Movement", rand(0.5, 0.85));
  addEdge(server, process2, "remote-process-create", "Lateral Movement", rand(0.6, 0.9));
  addEdge(process2, file1, "file-read", "File Server Access", rand(0.75, 0.97));
  addEdge(file1, file2, "file-encrypt", "File Modification", rand(0.8, 0.99));
  addEdge(process2, file2, "ransom-note-drop", "Impact", rand(0.85, 0.99));

  server && (nodes.find((n) => n.id === server).state = "Impacted");
  nodes.find((n) => n.id === workstation).state = "Compromised";
  nodes.find((n) => n.id === user).state = "Lateral-Movement Source";

  // --- Decoy / alternate-origin branches -------------------------------
  // These give Yen's algorithm real alternatives to rank, so the UI isn't
  // forced to show only one "true" path (brief section 6.2).
  for (let b = 0; b < branches; b++) {
    const altAttacker = addNode("attacker", "Internet", `Suspicious Source ${b + 1}`);
    const altEndpoint = addNode("network_endpoint", "DMZ", `Edge-FW-0${b + 1}`);
    const altWorkstation = addNode("host", "Corp-LAN", `WS-EMP-0${20 + b}`);
    const altCred = addNode("credential", "Corp-LAN", `svc-account-0${b}`);

    addEdge(altAttacker, altEndpoint, "port-scan", "Initial Access", rand(0.2, 0.5));
    addEdge(altEndpoint, altWorkstation, "exploit-attempt", "Initial Access", rand(0.25, 0.55));
    addEdge(altWorkstation, altCred, "credential-dump", "Credential Theft", rand(0.3, 0.6));
    // Rejoin the main chain at the lateral-movement user so the reverse
    // engine has a genuinely different, lower-confidence path to Impact.
    addEdge(altCred, user, "credential-use", "Credential Theft", rand(0.3, 0.55));
  }

  return { nodes, edges };
}

export { ZONES, STAGE_ORDER };
