const fs = require('fs');
const path = require('path');

const MAX_FILE_SIZE = 5000; // límite de caracteres por archivo
const ALLOWED_EXTENSIONS = ['.md', '.txt', '.sql', '.js', '.html', '.css', '.json'];

const AGENT_CONTEXT_MAP = {
  'database': ['/db'],
  'backend': ['/backend'],
  'frontend': ['/frontend'],
  'seo': ['/frontend', '/docs'],
  'automatizacion': ['/workflows'],
  'arquitecto': ['/docs'],
};

/**
 * Lee archivos recursivamente desde agentes/context/
 * @returns {Array} Lista de archivos con ruta y contenido
 */
function readContextFiles() {
  const contextPath = path.join(__dirname, '../context');
  const files = [];

  if (!fs.existsSync(contextPath)) {
    return files;
  }

  function walkDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);

          if (ALLOWED_EXTENSIONS.includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const relativePath = path.relative(contextPath, fullPath);

              files.push({
                path: relativePath,
                fullPath,
                ext,
                content: content.slice(0, MAX_FILE_SIZE),
                size: content.length,
              });
            } catch {
              // ignorar archivos que no se puedan leer
            }
          }
        }
      }
    } catch {
      // ignorar directorios que no se puedan leer
    }
  }

  walkDir(contextPath);
  return files;
}

/**
 * Calcula puntuación de relevancia
 * @param {String} text - Texto a analizar
 * @param {String} query - Query de búsqueda
 * @returns {Number} Puntuación
 */
function calculateRelevance(text, query) {
  if (!query) return 0;

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  let score = 0;

  for (const word of queryWords) {
    const count = (text.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    score += count * 10; // peso: 10 por ocurrencia

    // bonus si está en la primera línea (introducción)
    if (text.slice(0, 200).toLowerCase().includes(word)) {
      score += 5;
    }
  }

  return score;
}

/**
 * Prioriza archivos según carpeta del agente
 * @param {Array} files - Archivos con puntuación
 * @param {String} agentName - Nombre del agente
 * @returns {Array} Archivos priorizados
 */
function prioritizeByAgent(files, agentName) {
  const priorityDirs = AGENT_CONTEXT_MAP[agentName.toLowerCase()] || [];

  return files.map(file => {
    let bonus = 0;

    for (const dir of priorityDirs) {
      if (file.path.includes(dir)) {
        bonus += 100; // peso fuerte para carpetas prioritarias
        break;
      }
    }

    return {
      ...file,
      score: (file.score || 0) + bonus,
    };
  });
}

/**
 * Obtiene memoria de proyecto relevante
 * @param {String} request - Request/pregunta del usuario
 * @param {String} agentName - Nombre del agente que lo solicita
 * @returns {Object} Proyeto memory con top 5 archivos
 */
function getProjectMemory(request = '', agentName = '') {
  const allFiles = readContextFiles();

  if (!allFiles.length) {
    return {
      available: false,
      files: [],
      message: 'No context files available',
    };
  }

  // 1. Calcular relevancia por palabras clave
  const scoredFiles = allFiles.map(file => ({
    ...file,
    score: calculateRelevance(file.content, request),
  }));

  // 2. Priorizar por agente
  const prioritized = prioritizeByAgent(scoredFiles, agentName);

  // 3. Ordenar por puntuación
  const ranked = prioritized
    .filter(f => f.score > 0 || agentName) // siempre incluir si hay agente específico
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // top 5

  // Si no hay resultados con score > 0, devolver archivos al azar según agente
  if (!ranked.length && agentName) {
    const agentDirs = AGENT_CONTEXT_MAP[agentName.toLowerCase()] || [];
    const filtered = agentDirs.length
      ? prioritized.filter(f => agentDirs.some(d => f.path.includes(d)))
      : prioritized;

    return {
      available: true,
      files: filtered.slice(0, 5).map(f => ({
        name: path.basename(f.path),
        path: f.path,
        relevance: 'contextual',
        snippet: f.content.slice(0, 200),
      })),
      message: 'Context loaded',
    };
  }

  return {
    available: ranked.length > 0,
    files: ranked.map(f => ({
      name: path.basename(f.path),
      path: f.path,
      relevance: f.score,
      snippet: f.content.slice(0, 200),
    })),
    message: `Found ${ranked.length} relevant files`,
  };
}

module.exports = { getProjectMemory };