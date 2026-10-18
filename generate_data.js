const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'data', 'scenarios');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function generateScenario(name, branches, complexity) {
  const nodes = [];
  const edges = [];
  let t = 0;
  let nodeCount = 0;

  function addNode(type, zone, label, state = "Normal", desc = null) {
    const id = `${type}-${nodeCount++}`;
    if (!desc) desc = `${label} is part of the incident chain.`;
    nodes.push({ id, type, zone, label, state, description: desc });
    return id;
  }

  function addEdge(source, target, type, stage, confidence, dt = rand(20, 240)) {
    t += dt;
    edges.push({
      source, target, type, stage,
      timestamp: Math.round(t),
      confidence: Math.round(confidence * 100) / 100
    });
  }

  const attacker = addNode("attacker", "Internet", `Attacker ${name}`);
  const endpoint = addNode("network_endpoint", "DMZ", "Gateway");

  addEdge(attacker, endpoint, "phishing", "Initial Access", 0.7);

  let currentNode = endpoint;

  if (complexity === "High") {
    const ws = addNode("host", "Corp-LAN", "Workstation");
    addEdge(currentNode, ws, "exploit", "Initial Access", 0.8);
    currentNode = ws;
  }

  const cred = addNode("credential", "Corp-LAN", "Stolen Hash");
  addEdge(currentNode, cred, "credential-dump", "Credential Theft", 0.9);

  const server = addNode("host", "Server-VLAN", "Critical Server", "Impacted");
  addEdge(cred, server, "smb-logon", "Lateral Movement", 0.85);

  for (let b = 0; b < branches; b++) {
    const altAttacker = addNode("attacker", "Internet", `Suspicious ${b + 1}`);
    const altEp = addNode("network_endpoint", "DMZ", `FW-0${b + 1}`);
    addEdge(altAttacker, altEp, "port-scan", "Initial Access", 0.4);
    addEdge(altEp, cred, "credential-spray", "Credential Theft", 0.3);
  }

  return { name, nodes, edges };
}

const scenariosConfig = [
  { name: "Ransomware Spread", branches: 2, comp: "High" },
  { name: "DDoS Attempt", branches: 0, comp: "Low" },
  { name: "Insider Exfiltration", branches: 1, comp: "Medium" },
  { name: "Lateral Movement", branches: 3, comp: "High" },
  { name: "Phishing Campaign", branches: 4, comp: "Medium" },
  { name: "Zero-Day Exploit", branches: 1, comp: "High" },
  { name: "Brute Force Attack", branches: 5, comp: "Low" },
  { name: "Data Breach", branches: 2, comp: "High" },
  { name: "Supply Chain Compromise", branches: 1, comp: "Medium" },
  { name: "Malware Infection", branches: 0, comp: "Low" }
];

scenariosConfig.forEach((cfg, i) => {
  const data = generateScenario(cfg.name, cfg.branches, cfg.comp);
  const filename = path.join(dir, `scenario_${String(i + 1).padStart(2, '0')}.json`);
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
});

console.log("10 scenarios generated successfully.");
