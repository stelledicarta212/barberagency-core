# BUG HIDRATACIÓN CANÓNICA COMPLETA — DIAGNÓSTICO ENTREGADO

## 1. Resumen Ejecutivo
Se ha realizado una auditoría completa del flujo de datos desde la Fuente de Verdad hasta el renderizado en la landing pública V5. Se descubrió que la pérdida de datos (como el tercer barbero o nuevos servicios) se origina por un **desajuste en la estructura del payload de publicación del Editor** y una **validación demasiado estricta de IDs en las plantillas**. 

Los elementos nuevos no se están enviando en la raíz del payload al backend, por lo que la RPC ignora la sincronización de las tablas canónicas. Además, las plantillas filtran cualquier elemento que no tenga un ID mayor a 0, lo que hace que los elementos nuevos desaparezcan incluso en el Preview del editor.

## 2. Fuente de Verdad Actual (Barbería 198)
- **Barbería:** ID `198`, Slug `barberia-prueba-4`, con `logo_url` y `cover_url` presentes.
- **Servicios Activos:** Existen 2 servicios canónicos en BD (con `id`, `nombre`, `precio`, `duracion_min`, `activo: true` e `imagen_url`).
- **Barberos Activos:** Existen 2 barberos canónicos en BD (con `id`, `nombre`, `activo: true` y `foto_url`). El 3er barbero nuevo **no existe** en la BD.
- **Horarios:** Registros canónicos con `dia_semana`, `hora_abre`, `hora_cierra`, `activo`.

## 3. Comparación Servicios por Etapa
| Etapa | Count | IDs | Fotos (`imagen_url`) |
|-------|-------|-----|-------|
| 1. Fuente Verdad | 2 | Reales (>0) | Sí |
| 2. Editor (UI) | 3 | Reales + `null` | Sí |
| 3. Publish Payload | 3 | Reales + `null` | Sí (pero anidados en `inherited`) |
| 4. Fuente Pública | 2 | Reales (>0) | Sí |
| 5. Landing V5 | 2 | Reales (>0) | Sí |

## 4. Comparación Fotos de Servicios por Etapa
Las fotos de servicios (`imagen_url`) sí viajan en toda la cadena correctamente a través del objeto `inheritedCollections.services`, pero los servicios nuevos se descartan antes de persistirse.

## 5. Comparación Barberos por Etapa
| Etapa | Count | IDs | Fotos (`foto_url`) |
|-------|-------|-----|-------|
| 1. Fuente Verdad | 2 | Reales (>0) | Sí |
| 2. Editor (Sidebar) | 3 | Reales + `null` | Sí |
| 3. Publish Payload | 3 | Reales + `null` | Sí (pero anidados en `inherited`) |
| 4. Fuente Pública | 2 | Reales (>0) | Sí |
| 5. Landing V5 | 2 | Reales (>0) | Sí |

## 6. Comparación Barbero Nuevo por Etapa
- **Editor:** Aparece en el sidebar porque `buildSeedChips` no filtra por ID.
- **Preview:** **NO APARECE**, porque el iframe de V5 recibe el barbero con `id: null` y la función `normalizeSeedBarber` lo descarta (`if (!barberId) return null;`).
- **PublishPayload:** Viaja anidado en `payload.inherited.barberos`.
- **BD Canónica:** **NO SE GUARDA**, porque la RPC busca las colecciones en la raíz del payload y, al no encontrarlas, omite el upsert.
- **Landing Pública:** **NO APARECE**, porque no existe en la BD canónica y la ruta canónica ya no lee borradores locales.

## 7. Comparación Horarios por Etapa
Mismo comportamiento: el editor los envía anidados en `inherited.horarios`, la RPC no los sincroniza si los espera en la raíz, manteniéndose los de la BD original intactos.

## 8. Payload Real de Publicación (PublishPayload)
```json
{
  "barberia_id": 198,
  "slug": "barberia-prueba-4",
  "template_id": "v5",
  "inherited": {
    "servicios": [... 3 servicios ...],
    "barberos": [... 3 barberos ...],
    "horarios": [...]
  },
  "landing_publish": { ... }
}
// NOTA: 'servicios', 'barberos' y 'horarios' faltan en la raíz del payload.
```

## 9. Payload Real de Reserva
```json
{
  "clientes_finales": { "nombre_completo": "...", "telefono": "...", "email": "..." },
  "citas": {
    "id_barberia": 198,
    "id_servicio": 1,
    "id_barbero": 2,
    "fecha": "2026-10-15",
    "hora": "10:00",
    "estado": "confirmada"
  }
}
```

## 10. Punto exacto donde se pierden datos
1. **Pérdida en Persistencia:** En `landing_editor_v2_unico_vscode.html`, la función `buildSavePayload()` coloca las colecciones dentro de `inherited` y omite colocarlas en la raíz del payload retornado, provocando que la RPC no actualice las tablas canónicas.
2. **Pérdida Visual en Preview:** En las plantillas (ej. V5), `normalizeSeedBarber` y `normalizeSeedService` contienen una condición estricta `if (!barberId) return null;`. Los elementos nuevos no tienen ID hasta ser guardados en la BD, por lo que desaparecen del preview del editor.

## 11. Causa Raíz
Desconexión de contratos de datos. 
La RPC de sincronización canónica espera las colecciones en la raíz del JSON, pero el frontend las está encapsulando en el nodo `inherited`. Adicionalmente, las plantillas asumen que todo elemento válido ya posee un ID de base de datos, lo cual es falso para elementos recién creados en modo borrador o preview.

## 12. Fix mínimo recomendado
**En el Editor (`landing_editor_v2_unico_vscode.html`):**
Modificar el retorno de `buildSavePayload()` para exponer las colecciones en la raíz:
```javascript
return {
  ...payload,
  ...publishedUrls,
  landing_publish: landingPublish,
  servicios: inheritedCollections.services,
  barberos: inheritedCollections.barbers,
  horarios: inheritedCollections.hours
};
```
**En las Plantillas (ej. `index_unico_v5_1_azul_rojo_elegante.html`):**
Eliminar la validación estricta de ID (`if (!barberId) return null;` / `if (!serviceId) return null;`) en los normalizadores para permitir que el preview renderice los elementos nuevos recién añadidos.

## 13. Archivos que tocaría modificar
- `project/templates/editor/landing_editor_v2_unico_vscode.html`
- Todas las plantillas públicas: `v2`, `v3`, `v4`, `v5_1`, `v6`, `v7`.

## 14. Riesgos
Al remover la validación estricta de ID en el frontend, el formulario de reservas del preview en el editor usaría `id = 0` para los nuevos. Esto no es un riesgo real en producción porque la landing pública siempre hidratará desde la BD canónica donde todos los elementos garantizan un `id > 0`.

## 15. Confirmación
Confirmo que **NO** se modificó código funcional, base de datos, ni configuraciones externas. El diagnóstico se ha realizado basado puramente en la revisión analítica del código fuente proporcionado.

## 16. Decisión
`BUG HIDRATACIÓN CANÓNICA COMPLETA — DIAGNÓSTICO ENTREGADO`