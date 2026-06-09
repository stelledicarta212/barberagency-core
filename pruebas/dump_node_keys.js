const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'execution_476879.json');
const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
const pgNodeRun = data.data.resultData.runData['PG - login'][0];
console.log('PG - login keys:', Object.keys(pgNodeRun));
if (pgNodeRun.startTime) console.log('startTime:', pgNodeRun.startTime);
if (pgNodeRun.executionTime) console.log('executionTime:', pgNodeRun.executionTime);
console.log('JSON structure:', JSON.stringify(pgNodeRun, (key, value) => {
  // Truncate very long fields
  if (typeof value === 'string' && value.length > 500) {
    return value.substring(0, 100) + '... [TRUNCATED]';
  }
  return value;
}, 2));
