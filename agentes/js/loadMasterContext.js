const fs = require('fs');
const path = require('path');

let cachedMasterContext = null;

function loadMasterContext() {
  if (cachedMasterContext) {
    return cachedMasterContext;
  }

  const skillsDir = path.join(__dirname, '../skills');

  if (!fs.existsSync(skillsDir)) {
    throw new Error(`No existe la carpeta skills: ${skillsDir}`);
  }

  const files = fs
    .readdirSync(skillsDir)
    .filter(file => file.endsWith('.md'));

  if (!files.length) {
    throw new Error('No se encontraron archivos .md en /skills');
  }

  const fullContext = files
    .map(file => {
      const filePath = path.join(skillsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      return `# CONTEXTO: ${file}\n${content}`;
    })
    .join('\n\n');

  cachedMasterContext = fullContext;
  return cachedMasterContext;
}

function clearMasterContextCache() {
  cachedMasterContext = null;
}

module.exports = {
  loadMasterContext,
  clearMasterContextCache
};