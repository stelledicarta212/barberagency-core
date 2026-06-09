const fs = require('fs');
const path = require('path');

const workflows = {
  config_update: 'config_update_workflow.json',
  barberos: 'barberos_workflow.json',
  citas: 'citas_workflow.json',
  servicios: 'servicios_workflow.json',
  publicar: 'publicar_workflow.json'
};

for (const [name, filename] of Object.entries(workflows)) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filename}`);
    continue;
  }
  
  console.log(`\n================ INSPECTING: ${filename} ================`);
  const wf = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const pgNodes = (wf.nodes || []).filter(n => n.type === 'n8n-nodes-base.postgres');
  console.log(`Found ${pgNodes.length} Postgres nodes.`);
  
  pgNodes.forEach(node => {
    console.log(`- Node Name: "${node.name}" (ID: ${node.id})`);
    if (node.parameters && node.parameters.query) {
      console.log('Query:');
      console.log(node.parameters.query.trim());
    } else {
      console.log('No raw query found in parameters.');
    }
    console.log('--------------------------------------------------');
  });
}
