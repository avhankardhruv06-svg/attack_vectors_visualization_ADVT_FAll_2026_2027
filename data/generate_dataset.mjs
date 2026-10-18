import { simulateRansomwareIncident } from '../js/simulator.js';
import fs from 'node:fs';

const { nodes, edges } = simulateRansomwareIncident({ branches: 2 });

const esc = (value) => `"${String(value).replace(/"/g, '""')}"`;

const nodeHeader = ['id', 'type', 'zone', 'label', 'state', 'description'];
const nodeRows = nodes.map((n) => [n.id, n.type, n.zone, n.label, n.state, n.description]);
const edgeHeader = ['source', 'target', 'type', 'stage', 'timestamp', 'confidence'];
const edgeRows = edges.map((e) => [e.source, e.target, e.type, e.stage, e.timestamp, e.confidence]);

const nodeCsv = [nodeHeader, ...nodeRows].map((row) => row.map(esc).join(',')).join('\n') + '\n';
const edgeCsv = [edgeHeader, ...edgeRows].map((row) => row.map(esc).join(',')).join('\n') + '\n';

fs.mkdirSync(new URL('.', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./attack_graph_nodes.csv', import.meta.url), nodeCsv);
fs.writeFileSync(new URL('./attack_graph_edges.csv', import.meta.url), edgeCsv);

console.log(JSON.stringify({
  nodes: nodes.length,
  edges: edges.length,
  files: [
    'data/attack_graph_nodes.csv',
    'data/attack_graph_edges.csv',
  ],
}, null, 2));
