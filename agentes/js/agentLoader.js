const fs = require('fs');
const path = require('path');

// Ruta fija a los archivos Markdown de agentes
const skillsPath = path.resolve(__dirname, '..', 'skills');

function extractAgentNameFromFile(file) {
  const base = path.basename(file, '.md');
  return base
    .replace(/^\d+[-_]?/, '')
    .trim()
    .toLowerCase();
}

function loadAgentsFromMarkdown(skillsDir = skillsPath) {
  const files = fs.readdirSync(skillsDir).filter(f => f.toLowerCase().endsWith('.md'));
  const agents = {};

  files.forEach(file => {
    const filePath = path.join(skillsDir, file);
    const md = fs.readFileSync(filePath, 'utf8');
    const name = extractAgentNameFromFile(file);
    const prompt = md.trim();

    agents[name] = {
      name,
      sourceFile: filePath,
      prompt,
      run: async (input = {}) => {
        return {
          agent: name,
          input,
          prompt,
          output: `Ejecutado agente ${name} con entrada ${JSON.stringify(input)}`,
        };
      },
    };
  });

  return agents;
}

module.exports = { loadAgentsFromMarkdown };
