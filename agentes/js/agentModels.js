// agentes/js/agentModels.js

const agentModels = {
  frontend: "openai/gpt-4o-mini",
  backend: "openai/gpt-4o-mini",
  database: "openai/gpt-4o-mini",
  arquitecto: "openai/gpt-4o"
};

function getModelForAgent(agentName) {
  return agentModels[agentName] || "openai/gpt-4o-mini";
}

module.exports = {
  getModelForAgent
};