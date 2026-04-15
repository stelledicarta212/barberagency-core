const { getProjectMemory } = require('./memory');

console.log('\n=== TEST: getProjectMemory ===\n');

// Test 1: frontend agent
console.log('TEST 1: Frontend agent + landing request');
const result1 = getProjectMemory('crear landing con formulario', 'frontend');
console.log(JSON.stringify(result1, null, 2));

// Test 2: database agent
console.log('\n\nTEST 2: Database agent + datos request');
const result2 = getProjectMemory('guardar datos en base de datos', 'database');
console.log(JSON.stringify(result2, null, 2));

// Test 3: workflow agent
console.log('\n\nTEST 3: Automatizacion agent + reservas');
const result3 = getProjectMemory('workflow reservas n8n', 'automatizacion');
console.log(JSON.stringify(result3, null, 2));

// Test 4: sin request
console.log('\n\nTEST 4: Arquitecto agent sin request específico');
const result4 = getProjectMemory('', 'arquitecto');
console.log(JSON.stringify(result4, null, 2));

console.log('\n✅ Todos los tests completados\n');
