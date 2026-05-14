const fs = require('fs');
let txt = fs.readFileSync('_wf_raw.json','utf8');
if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
const wf = JSON.parse(txt);

const nodes = wf.nodes;
const connections = wf.connections || {};

const manualId = 'a9c30c4d-7e11-4da8-9ddf-9f44fe0b1001';
const setId = 'b8e49f2c-56f0-4cc6-8f9f-5f89f9322002';

if (!nodes.find(n => n.id === manualId)) {
  nodes.push({
    id: manualId,
    name: 'Manual Trigger Test',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [-2240, 80],
    parameters: {}
  });
}

if (!nodes.find(n => n.id === setId)) {
  nodes.push({
    id: setId,
    name: 'Payload Mock Test',
    type: 'n8n-nodes-base.set',
    typeVersion: 3.4,
    position: [-2048, 80],
    parameters: {
      mode: 'manual',
      duplicateItem: false,
      assignments: {
        assignments: [
          { id: 'm1', name: 'headers', value: '={{ { "content-type": "application/json" } }}', type: 'object' },
          { id: 'm2', name: 'params', value: '={{ {} }}', type: 'object' },
          { id: 'm3', name: 'query', value: '={{ {} }}', type: 'object' },
          { id: 'm4', name: 'body', value: '={{ { "message": "Quiero agendar Hemograma para 4/5/2026 a las 11:00 AM", "telefono": "3000000010", "media_type": "text" } }}', type: 'object' },
          { id: 'm5', name: 'webhookUrl', value: '="manual-test"', type: 'string' },
          { id: 'm6', name: 'executionMode', value: '="manual"', type: 'string' }
        ]
      },
      includeOtherFields: false,
      options: {}
    }
  });
}

// Ensure connections
connections['Manual Trigger Test'] = {
  main: [[{ node: 'Payload Mock Test', type: 'main', index: 0 }]]
};
connections['Payload Mock Test'] = {
  main: [[{ node: 'Clasificador Multimodal', type: 'main', index: 0 }]]
};

const payload = { name: wf.name, nodes, connections, settings: {} };
fs.writeFileSync('_wf_payload.json', JSON.stringify(payload));
