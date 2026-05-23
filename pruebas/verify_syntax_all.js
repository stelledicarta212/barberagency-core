const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = 'C:\\Users\\calvi\\OneDrive\\n8n\\Visual studio\\barberagency-core\\project\\templates\\plantillas';
const templates = [
  'index_unico_v2.html',
  'index_unico_v3_nueva.html',
  'index_unico_v4_editorial.html',
  'index_unico_v5_1_azul_rojo_elegante.html',
  'index_unico_v6_negro_dorado.html',
  'index_unicov7.html'
];

let allPassed = true;

console.log('=== Iniciando verificación sintáctica de plantillas ===\n');

templates.forEach((templateName) => {
  const filePath = path.join(baseDir, templateName);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Archivo no encontrado: ${templateName}`);
    return;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  let hasErrors = false;

  console.log(`Verificando ${templateName}...`);

  while ((match = scriptRegex.exec(html)) !== null) {
    count++;
    const js = match[1];
    try {
      new vm.Script(js);
    } catch (err) {
      console.error(`  ❌ Error de sintaxis en Script #${count}!`);
      console.error(err);
      hasErrors = true;
      allPassed = false;
    }
  }

  if (!hasErrors) {
    console.log(`  ✅ ${count} scripts validados sin errores de sintaxis.`);
  }
  console.log('');
});

if (allPassed) {
  console.log('🎉 ¡Todas las plantillas pasaron la verificación de sintaxis exitosamente!');
  process.exit(0);
} else {
  console.error('❌ Se encontraron errores de sintaxis en una o más plantillas.');
  process.exit(1);
}
