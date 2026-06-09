const fs = require('fs');
const path = require('path');

function parseNodeInput(execData, nodeName) {
  try {
    const runData = execData.data.resultData.runData;
    const nodeRun = runData[nodeName];
    if (nodeRun && nodeRun[0] && nodeRun[0].data && nodeRun[0].data.main && nodeRun[0].data.main[0]) {
      // Return the input parameters (queryReplacement)
      return nodeRun[0].parameterData;
    }
  } catch (e) {
    console.error(`Error parsing input for ${nodeName}:`, e.message);
  }
  return null;
}

const ids = ['476879', '476481'];
for (const id of ids) {
  console.log(`\n================ ID: ${id} ================`);
  const filepath = path.join(__dirname, `execution_${id}.json`);
  if (!fs.existsSync(filepath)) {
    console.log(`File not found: ${filepath}`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  
  // Let's print the parameters evaluated for PG - login
  const pgNodeRun = data.data.resultData.runData['PG - login'][0];
  console.log('PG - login node parameters:', JSON.stringify(pgNodeRun.parameterData || pgNodeRun.params, null, 2));
}
