const fs = require('fs');
const path = require('path');

function parseNodeOutput(execData, nodeName) {
  try {
    const runData = execData.data.resultData.runData;
    const nodeRun = runData[nodeName];
    if (nodeRun && nodeRun[0] && nodeRun[0].data && nodeRun[0].data.main && nodeRun[0].data.main[0]) {
      return nodeRun[0].data.main[0].map(item => item.json);
    }
  } catch (e) {
    console.error(`Error parsing ${nodeName}:`, e.message);
  }
  return null;
}

const ids = ['476879', '476481', '476864'];
for (const id of ids) {
  console.log(`\n================ ID: ${id} ================`);
  const filepath = path.join(__dirname, `execution_${id}.json`);
  if (!fs.existsSync(filepath)) {
    console.log(`File not found: ${filepath}`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  
  if (id === '476864') {
    const parseReq = parseNodeOutput(data, 'Code - parse request');
    const prepareSql = parseNodeOutput(data, 'Code - prepare SQL');
    console.log('Code - parse request output:', JSON.stringify(parseReq, null, 2));
    console.log('Code - prepare SQL output:', JSON.stringify(prepareSql, null, 2));
  } else {
    const pgLogin = parseNodeOutput(data, 'PG - login');
    const normalize = parseNodeOutput(data, 'Code - normalize');
    console.log('Code - normalize output:', JSON.stringify(normalize, null, 2));
    console.log('PG - login output:', JSON.stringify(pgLogin, null, 2));
  }
}
