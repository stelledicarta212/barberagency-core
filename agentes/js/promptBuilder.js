function formatMemory(memoryResult, agentName) {
  if (!memoryResult || !memoryResult.files || !memoryResult.files.length) {
    return "No se encontró contexto relevante en memoria.";
  }

  const maxFilesByAgent = {
    frontend: 2,
    automation: 2,
    database: 2,
    architect: 4
  };

  const maxSnippetByAgent = {
    frontend: 300,
    automation: 350,
    database: 350,
    architect: 700
  };

  const maxFiles = maxFilesByAgent[agentName] || 2;
  const maxSnippet = maxSnippetByAgent[agentName] || 300;

  return memoryResult.files
    .slice(0, maxFiles)
    .map((file, index) => {
      const rawSnippets = Array.isArray(file.snippets)
        ? file.snippets.join("\n")
        : (file.snippet || "Sin snippet disponible");

      const snippets = String(rawSnippets).slice(0, maxSnippet);

      return [
        `## Contexto ${index + 1}`,
        `Archivo: ${file.name || "sin_nombre"}`,
        `Relevancia: ${file.relevance || 0}`,
        `Contenido relevante:`,
        snippets
      ].join("\n");
    })
    .join("\n\n");
}

function getProjectRules() {
  return `
# Reglas del proyecto BarberAgency

- NO hardcodear datos.
- NO romper la arquitectura.
- PLANTILLA = render puro.
- EDITOR = fuente de verdad.
- BACKEND = lógica.
- DB = persistencia.
- Las plantillas NO deben contener lógica de negocio.
- Las decisiones de flujo deben mantenerse fuera del render visual.
- Debes respetar la arquitectura multi-tenant del SaaS.
- Responde con foco técnico, claridad y pasos accionables.
`.trim();
}

function getAgentFocus(agentName) {
  const map = {
    architect: `
Tu rol es arquitecto jefe.
- Decides estructura.
- Orquestas agentes.
- Priorizas consistencia, separación de responsabilidades y escalabilidad.
`.trim(),

    frontend: `
Tu rol es frontend.
- Enfócate en plantillas, UI, CSS, HTML, JS visual y responsive.
- No muevas lógica de negocio al frontend.
- Las plantillas solo renderizan datos.
`.trim(),

    automation: `
Tu rol es automation.
- Enfócate en n8n, flujos, payloads, publicación, QR, integraciones y backend automation.
- Mantén la lógica desacoplada del frontend.
`.trim(),

    database: `
Tu rol es database.
- Enfócate en SQL, estructura, integridad, relaciones y persistencia.
- Prioriza consistencia de datos y diseño multi-tenant.
`.trim()
  };

  return map[agentName] || `
Tu rol es técnico dentro de BarberAgency.
Debes responder con precisión y sin romper la arquitectura.
`.trim();
}

function getMasterContextSlice(masterContext, agentName) {
  if (!masterContext) return "No se proporcionó contexto maestro.";

  const limits = {
    frontend: 1200,
    automation: 1400,
    database: 1400,
    architect: 3000
  };

  const maxLen = limits[agentName] || 1200;
  return String(masterContext).slice(0, maxLen);
}

function buildPrompt({ agentName, userInput, memoryResult, masterContext, agentPrompt }) {
  const memoryText = formatMemory(memoryResult, agentName);
  const masterSlice = getMasterContextSlice(masterContext, agentName);

  return `
# SISTEMA
Eres el agente "${agentName}" del proyecto BarberAgency.

# FOCO DEL AGENTE
${getAgentFocus(agentName)}

# REGLAS DEL PROYECTO
${getProjectRules()}

# CONTEXTO BASE DEL AGENTE
${agentPrompt || "Sin contexto base del agente."}

# CONTEXTO MAESTRO DEL PROYECTO
${masterSlice}

# CONTEXTO DINÁMICO ENCONTRADO POR MEMORY
${memoryText}

# SOLICITUD DEL USUARIO
${userInput}

# INSTRUCCIONES DE RESPUESTA
- Usa solo el contexto relevante.
- Si propones código, que sea coherente con la arquitectura actual.
- No inventes archivos si no son necesarios.
- Si falta algo, dilo claramente.
- Prioriza soluciones implementables.
- Responde de forma técnica, clara y accionable.
`.trim();
}

module.exports = {
  buildPrompt
};