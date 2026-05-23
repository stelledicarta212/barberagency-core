const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = 'C:\\Users\\calvi\\OneDrive\\n8n\\Visual studio\\barberagency-core\\project\\templates\\plantillas\\index_unico_v3_nueva.html';

if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const html = fs.readFileSync(file, 'utf8');
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
console.log(`\nVerifying: ${path.basename(file)}`);

while ((match = scriptRegex.exec(html)) !== null) {
  count++;
  const js = match[1];
  try {
    new vm.Script(js);
    console.log(`  Script #${count}: Syntactically valid!`);
  } catch (err) {
    console.error(`  Script #${count}: Syntax error!`);
    console.error(err);
    process.exit(1);
  }
}
console.log('\nSyntax check passed successfully for index_unico_v3_nueva.html!');
