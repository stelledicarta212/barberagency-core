const fs = require('fs');
let txt = fs.readFileSync('_wf_raw.json','utf8');
if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
const wf = JSON.parse(txt);

const respond = wf.nodes.find(n => n.id === 'd13453e4-7031-4ccc-b9c9-619c1e07a55e');
if (!respond) throw new Error('Respond node not found');

respond.parameters.responseBody = `={{ {
  mensaje: ($json.mensaje || $json.output || "Sin respuesta generada").replace(/^=/, ""),
  html_card:
    '<div style="font-family:Arial;padding:16px;border:1px solid #ddd;border-radius:12px;max-width:420px">' +
    '<h3 style="margin:0 0 8px 0;">Cita Confirmada</h3>' +
    '<p><b>Paciente:</b> ' + (($json.nombre || $json.paciente || '') + ' ' + ($json.apellido || '')).trim() + '</p>' +
    '<p><b>Examen:</b> ' + ($json.examen || '') + '</p>' +
    '<p><b>Fecha:</b> ' + ($json.fecha || '') + '</p>' +
    '<p><b>Hora:</b> ' + ($json.hora || '') + '</p>' +
    '<p><b>Estado:</b> ' + ($json.estado || 'Confirmada') + '</p>' +
    '</div>'
} }`;

const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: {} };
fs.writeFileSync('_wf_payload.json', JSON.stringify(payload));
