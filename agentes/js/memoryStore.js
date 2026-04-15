const memory = [];
const MAX_HISTORY = 10;

function saveMemory(input = {}, output = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    input,
    output,
  };

  memory.push(event);

  if (memory.length > MAX_HISTORY) {
    memory.shift();
  }

  return event;
}

function getMemory() {
  return [...memory];
}

module.exports = { saveMemory, getMemory };