const { agentChain } = require('./agentManager');

// 🧠 decidir qué agentes usar (adaptado a tus nombres reales)
function decidePlan(request = '') {
  const r = String(request).toLowerCase();

  const hasAny = (words) => words.some(word => r.includes(word));

  const isFrontend = hasAny([
    'landing', 'plantilla', 'template', 'html', 'css', 'ui', 'ux',
    'responsive', 'diseño', 'diseno', 'hero', 'formulario visual',
    'preview', 'editor visual', 'componente', 'estilo'
  ]);

  const isDatabase = hasAny([
    'sql', 'tabla', 'tablas', 'columna', 'columnas', 'postgres',
    'postgresql', 'db', 'base de datos', 'schema', 'rls', 'jwt',
    'query', 'consulta', 'indice', 'índice', 'trigger', 'vista',
    'migration', 'migracion', 'constraint'
  ]);

  const isBackend = hasAny([
    'n8n', 'workflow', 'webhook', 'automatizacion', 'automatización',
    'flujo', 'integracion', 'integración', 'payload', 'qr',
    'publicacion', 'publicación', 'reserva', 'reservas',
    'endpoint', 'api', 'postgrest'
  ]);

  const isArchitecture = hasAny([
    'arquitectura', 'arquitecto', 'estrategia', 'estructura general',
    'enfoque', 'diseñar sistema', 'disenar sistema', 'multi-tenant',
    'escalable', 'escalabilidad', 'decidir', 'analiza', 'analizar',
    'impacto', 'sin romper', 'qué conviene', 'que conviene'
  ]);

  // 🧠 si es complejo → arquitecto + otros
  if (isArchitecture) {
    const plan = ['arquitecto'];

    if (isBackend) plan.push('backend');
    if (isDatabase) plan.push('database');
    if (isFrontend) plan.push('frontend');

    return plan;
  }

  // 🧩 tareas simples
  const plan = [];

  if (isFrontend) plan.push('frontend');
  if (isBackend) plan.push('backend');
  if (isDatabase) plan.push('database');

  if (plan.length > 0) return plan;

  // fallback
  return ['arquitecto'];
}

// 🚀 orquestador principal
async function runJefe(input = {}) {
  try {
    const request = input.request || '';

    const plan = decidePlan(request);

    const chainResult = await agentChain(
      { request },
      plan
    );

    return {
      ok: true,
      plan,
      chainResult
    };

  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

module.exports = {
  runJefe,
  decidePlan
};