const { runGemini } = require('./gemini');
const { getProjectMemory } = require('./memory');
const { buildPrompt } = require('./promptBuilder');
const { loadMasterContext } = require('./loadMasterContext');
const { getModelForAgent } = require('./agentModels'); // ✅ NUEVO
const fs = require('fs');
const path = require('path');

// 📂 cargar agentes (.md)
function loadAgents() {
  const dir = path.join(__dirname, '../skills');
  const files = fs.readdirSync(dir);

  const agents = {};

  for (const file of files) {
    const name = file.replace('.md', '').replace(/^\d+-/, '');
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');

    agents[name] = {
      name,
      prompt: content,
    };
  }

  return agents;
}

const agents = loadAgents();

// 📋 listar agentes
function listAgents() {
  return Object.keys(agents);
}

// 🛡️ evitar JSON circular
function safeResult(result) {
  if (typeof result === 'string') return result;

  try {
    return JSON.stringify(result, null, 2).slice(0, 4000); // 🔥 reducido
  } catch {
    return '[Unserializable result]';
  }
}

// ✅ validar si el resultado es suficientemente bueno
function isGoodResult(result) {
  if (!result || typeof result !== 'object') return false;
  if (result.ok !== true) return false;
  if (!result.output) return false;

  const output = String(result.output).toLowerCase();
  const length = String(result.output).length;

  if (length < 100) return false;

  const errorKeywords = ['error', 'fail', 'undefined', 'no encontrado', 'falló'];
  for (const keyword of errorKeywords) {
    if (output.includes(keyword)) return false;
  }

  return true;
}

// 🤖 ejecutar un agente
async function runAgent(name, input = {}) {
  try {
    const agent = agents[name];
    if (!agent) throw new Error(`Agente no encontrado: ${name}`);

    const masterContext = loadMasterContext();
    const projectMemory = getProjectMemory(input.request || '', name);

    const finalPrompt = buildPrompt({
      agentName: name,
      userInput: input.request || '',
      memoryResult: projectMemory,
      masterContext,
      agentPrompt: agent.prompt
    });

    // 🔥 NUEVO: seleccionar modelo dinámico
    const model = getModelForAgent(name);

    const result = await runGemini(finalPrompt, {
      ...input,
      model, // ✅ clave
    });

    return {
      ok: true,
      agent: name,
      output: result,
    };

  } catch (error) {
    return {
      ok: false,
      agent: name,
      error: error.message,
    };
  }
}

// 🔗 ejecutar cadena de agentes (con auto-stop inteligente)
async function agentChain(input = {}, agentList = []) {
  if (!Array.isArray(agentList) || agentList.length === 0) {
    throw new Error('Lista de agentes inválida.');
  }

  if (agentList.length > 5) {
    throw new Error('Máximo 5 agentes permitidos.');
  }

  const chainHistory = [];
  let currentInput = { ...input };

  for (let i = 0; i < agentList.length; i++) {
    const agentName = agentList[i];
    const isFirstAgent = i === 0;
    const hasMinimumAgents = chainHistory.length >= 2;

    console.log(`\n⚙️ Ejecutando agente: ${agentName}`);

    const result = await runAgent(agentName, {
      ...currentInput,
      chainHistory: chainHistory.slice(-2), // 🔥 optimizado
    });

    chainHistory.push({
      agent: agentName,
      result: safeResult(result),
    });

    currentInput = {
      request: input.request,
      context: safeResult(result),
      chainHistory,
    };

    const isGood = isGoodResult(result);
    const canStop = !isFirstAgent && hasMinimumAgents;

    console.log(`✔️ ¿Resultado suficiente? ${isGood} | Pueden detener? ${canStop}`);

    if (isGood && canStop) {
      console.log(`🛑 Auto-stop: Respuesta satisfactoria después de ${chainHistory.length} agentes\n`);
      break;
    }
  }

  return {
    chain: chainHistory,
    finalOutput: chainHistory[chainHistory.length - 1]?.result || null,
  };
}

module.exports = {
  runAgent,
  listAgents,
  agentChain,
};