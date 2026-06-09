const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'execution_detail.json'), 'utf8'));

console.log('Top level keys:', Object.keys(data));
if (data.data) {
  console.log('data keys:', Object.keys(data.data));
  if (data.data.resultData) {
    console.log('resultData keys:', Object.keys(data.data.resultData));
  }
}
fs.writeFileSync(path.join(__dirname, 'execution_structure.json'), JSON.stringify(Object.keys(data).reduce((acc, k) => {
  acc[k] = typeof data[k] === 'object' && data[k] !== null ? Object.keys(data[k]) : data[k];
  return acc;
}, {}), null, 2));
console.log('Saved structure to execution_structure.json');
