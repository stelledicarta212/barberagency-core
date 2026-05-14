const fs = require('fs');
let txt = fs.readFileSync('_wf_raw.json','utf8');
if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
const wf = JSON.parse(txt);
const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: {} };

for (const n of payload.nodes) {
  // Consultar Disponibilidad: dejar SOLO fecha + hora (sin filtro por disponible)
  if (n.id === 'c13c8227-d3fc-4f59-a54d-fb66b1e20c5e') {
    const vals = n.parameters?.filtersUI?.values || [];
    n.parameters.filtersUI.values = vals.filter(v => ['fecha','hora'].includes(v.lookupColumn));
  }

  // Buscar Alternativas: sin filtros estrictos para no devolver vacío
  if (n.id === 'ba780432-53cd-4db1-8008-03d4aca8a95b') {
    if (!n.parameters.filtersUI) n.parameters.filtersUI = { values: [] };
    n.parameters.filtersUI.values = [];
  }

  // Agente de Agendamiento: prompt robusto para alternativa obligatoria
  if (n.id === 'd538f3c4-fa36-4d46-b1ad-0e33cd62d83a') {
    n.parameters.text = '={{ $json.mensaje_limpio }}';
    n.parameters.options.systemMessage = `=Eres el Agente de Agendamiento de MedFlow AI.

Objetivo: agendar citas fácil y sin fricción.

Datos obligatorios: examen, fecha, hora, nombre, apellido, telefono.
Si falta un dato, pide SOLO ese dato (breve).

Flujo obligatorio:
1) Usa "Consultar Disponibilidad (Tool)" con fecha y hora.
2) Si el horario exacto está disponible, responde: 
"Sí, está disponible. ¿Deseas confirmar la cita?"
3) Si NO está disponible, SIEMPRE usa "Buscar Alternativas Disponibles (Tool)" y ofrece máximo 3 alternativas claras (fecha + hora + examen).
4) Si el usuario confirma, usa "Bloquear Horario (Tool)" y luego "Guardar Cita (Tool)".

Reglas:
- No inventes disponibilidad.
- No digas "no hay alternativas" sin consultar la tool de alternativas.
- Si hay varias opciones, prioriza la misma fecha y examen; si no, ofrece las más cercanas.
- Responde corto, humano y accionable.`;
  }
}

fs.writeFileSync('_wf_payload.json', JSON.stringify(payload));
