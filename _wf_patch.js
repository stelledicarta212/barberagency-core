const fs = require('fs');
let txt = fs.readFileSync('_wf_raw.json','utf8');
if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
const wf = JSON.parse(txt);
for (const n of wf.nodes) {
  if (n.id === 'c13c8227-d3fc-4f59-a54d-fb66b1e20c5e' || n.id === 'ba780432-53cd-4db1-8008-03d4aca8a95b') {
    const vals = n.parameters?.filtersUI?.values || [];
    for (const v of vals) if (v.lookupColumn === 'false') v.lookupColumn = 'disponible';
  }
  if (n.id === '3b389602-5bf2-4b71-889c-a92c6a4e0a42') {
    const value = n.parameters?.columns?.value;
    if (value && Object.prototype.hasOwnProperty.call(value,'false')) { value.disponible = value.false; delete value.false; }
    const schema = n.parameters?.columns?.schema || [];
    for (const s of schema) {
      if (s.id === 'false') s.id = 'disponible';
      if (s.displayName === 'false') s.displayName = 'disponible';
    }
  }
}
const patchBody = { nodes: wf.nodes, connections: wf.connections };
fs.writeFileSync('_wf_patch.json', JSON.stringify(patchBody));
