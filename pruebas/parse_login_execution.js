const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'login_executions.json'), 'utf8'));

if (data.data && data.data.length > 0) {
  const firstExec = data.data[0];
  console.log('--- EXECUTION DETAILS ---');
  console.log('ID:', firstExec.id);
  console.log('Status:', firstExec.status);
  console.log('Finished:', firstExec.finished);
  console.log('Mode:', firstExec.mode);
  console.log('Started At:', firstExec.startedAt);
  console.log('Stopped At:', firstExec.stoppedAt);
  
  // Let's print the structure of firstExec to see where the data is
  console.log('Keys in execution object:', Object.keys(firstExec));
  
  // Save a trimmed version for easy inspection
  fs.writeFileSync(path.join(__dirname, 'login_executions_sample.json'), JSON.stringify(firstExec, null, 2));
  console.log('Saved detailed first execution to login_executions_sample.json');
} else {
  console.log('No data found in execution file.');
}
