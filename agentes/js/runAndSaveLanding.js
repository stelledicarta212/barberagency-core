require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { runJefe } = require('./jefe');

function extractHtml(text = '') {
  const clean = String(text || '').trim();

  const fenced = clean.match(/```html\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();

  const genericFence = clean.match(/```\s*([\s\S]*?)```/);
  if (genericFence && genericFence[1]) return genericFence[1].trim();

  if (clean.includes('<!doctype html') || clean.includes('<html')) {
    return clean;
  }

  return clean;
}

async function main() {
  try {
    const request = `
Crea un archivo HTML completo de una landing sencilla para barbería.

Requisitos:
- responsive
- hero principal
- sección de servicios
- formulario visual simple
- diseño moderno
- colores elegantes
- devolver SOLO HTML completo listo para guardar
- no expliques nada
`.trim();

    const result = await runJefe({ request });

    if (!result?.ok) {
      throw new Error(result?.error || 'runJefe falló');
    }

    const chain = result?.chainResult?.chain || [];

    const frontendStep = chain.find(step => step.agent === 'frontend');

    if (!frontendStep?.result) {
      throw new Error('No se encontró resultado del agente frontend');
    }

    let parsed;
    try {
      parsed = JSON.parse(frontendStep.result);
    } catch (e) {
      console.log('\n⚠ No se pudo parsear como JSON. Intentando usar texto directo...\n');
      parsed = { output: frontendStep.result };
    }

    const html = extractHtml(parsed?.output || '');

    if (!html || html.length < 200) {
      throw new Error('El HTML generado parece vacío o incompleto');
    }

    const outputDir = path.join(__dirname, '../../pruebas');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'landing-agente.html');
    fs.writeFileSync(outputPath, html, 'utf-8');

    console.log('\n✅ Landing guardada correctamente:');
    console.log(outputPath);
    console.log('\n👉 Ábrela con Live Server desde VSCode.');

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error(error.message);
  }
}

main();