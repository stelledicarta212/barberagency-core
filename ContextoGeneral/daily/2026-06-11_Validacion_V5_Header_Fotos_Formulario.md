# Reporte de Validación de Producción — V5 Header, Fotos y Formulario

* **Fecha de Validación**: 2026-06-11
* **Barbería de Prueba**: ID 198 (`barberia-prueba-4`)
* **Versión de Validación**: Commit `f953531a73eb01efb082c1e5573a8d87188e8929`
* **Estatus de la Tarea**: BUG SIGUE ABIERTO CON EVIDENCIA (Falta copia de HTML a WordPress)

---

## 1. Resumen Ejecutivo
Se realizó una auditoría completa del estado de hidratación y diseño visual de la plantilla **V5 (Prestigio Ejecutivo / Elegancia Comercial)** y del **Editor de Landings V2** en el entorno de producción. 

Los archivos locales contienen el fix correcto e implementan las funciones de sanitización (`isKnownPlaceholderImage`, `safeImageUrl`, `resolveServiceImage`), y resuelven el problema de los IDs inventados. Sin embargo, **la validación en producción ha fallado porque el HTML actualizado no ha sido copiado a las páginas físicas correspondientes de WordPress**.

Las páginas físicas en la instancia de WordPress (`/index_unico_v5_1_azul_rojo_elegante/` y `/landing_editor_v2/`) siguen sirviendo la versión anterior del código, lo que causa que:
1. El placeholder `images.unsplash.com/cover.jpg` no sea bloqueado en la landing en vivo.
2. Los servicios y barberos con imágenes reales no se resuelvan bajo los nuevos criterios locales.
3. Se requiera la acción manual de actualización de plantillas en el administrador de WordPress para cerrar la validación de producción.

---

## 2. HTML copiado a WordPress
* **Estatus**: **NO COPIADO / DESACTUALIZADO**.
* **Diferencia detectada**:
  * **Local (`project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html`)**: **108,907 caracteres**, contiene la lógica de sanitización `isKnownPlaceholderImage` y `resolveServiceImage`.
  * **WordPress Live (`/index_unico_v5_1_azul_rojo_elegante/`)**: **180,862 caracteres**, no contiene ninguna referencia a `isKnownPlaceholderImage` ni `resolveServiceImage`.
* **Editor local vs en vivo**:
  * **Local (`project/templates/editor/landing_editor_v2_unico_vscode.html`)**: Contiene `getCanonicalSeedCoverUrl()`.
  * **WordPress Live (`/landing_editor_v2/`)**: No contiene la función.

---

## 3. URL WordPress Validada
* **URL de la plantilla V5**: [https://barberagency-barberagency.gymh5g.easypanel.host/index_unico_v5_1_azul_rojo_elegante/](https://barberagency-barberagency.gymh5g.easypanel.host/index_unico_v5_1_azul_rojo_elegante/)
* **URL del editor**: [https://barberagency-barberagency.gymh5g.easypanel.host/landing_editor_v2/](https://barberagency-barberagency.gymh5g.easypanel.host/landing_editor_v2/)
* **URL de la Landing Pública**: [https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-prueba-4](https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-prueba-4)

---

## 4. Plantilla Renderizada
* **Esperado**: Estructura visual de **V5.1 BlueRed** (Prestigio Ejecutivo).
* **Renderizado real**: Se visualiza la estructura base de V5 (BlueRed), pero debido a que el HTML en WordPress no está actualizado, no cuenta con los scripts de hidratación robustecida de Codex.

---

## 5. Resultado Header/Hero
* **Fuente de verdad (DB - public.barberia_landing_publish)**: `cover_url = "https://images.unsplash.com/cover.jpg"` (Placeholder).
* **Comportamiento local (esperado)**: `isKnownPlaceholderImage` bloquea el placeholder y renderiza el fondo original/default de V5.
* **Comportamiento en vivo (actual)**: Intenta cargar el placeholder `images.unsplash.com/cover.jpg`, resultando en un fondo roto o ausente en el renderizado final del Hero.

---

## 6. Resultado Fotos Servicios
* **Comportamiento local (esperado)**: Uso de `resolveServiceImage(item)` que valida en orden: `foto_url`, `foto`, `imagen`, `image_url`, `image`, `cover_url`, `media_url`, `photo`, `imagen_url`.
* **Comportamiento en vivo (actual)**: El formulario y lista de servicios en vivo renderiza imágenes únicamente si están en la clave `imagen_url`, ignorando las variantes locales adicionales.

---

## 7. Resultado Servicios: Fuente vs Formulario

### Fuente de Verdad (PostgreSQL)
* **Total Servicios en DB**: 5
* **Servicios Activos**: 3
* **Detalle**:
  1. **ID 489**: "Corte Clasico" (20,000.00 COP) | Foto: `https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg`
  2. **ID 490**: "Barba" (12,000.00 COP) | Foto: `https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427727.png`
  3. **ID 491**: "Corte + Cejas" (15,000.00 COP) | Foto: `https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427728.png`
* **Servicios Inactivos**: 2 (IDs 506, 507 — "Corte de Test")

### Formulario Renderizado (V5 Público)
* **Cantidad**: 3 servicios activos mostrados.
* **Coincidencia**: Coinciden plenamente en nombres y precios. No hay servicios inactivos ni inventados.

---

## 8. Resultado Barberos: Fuente vs Formulario

### Fuente de Verdad (PostgreSQL)
* **Total Barberos en DB**: 5
* **Barberos Activos**: 2
  1. **ID 439**: "Barbero prueba 4" | Foto: `https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427729.jpg`
  2. **ID 440**: "Barbero Prueba 4.1" | Foto: `https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427730.jpg`
* **Barberos Inactivos**: 3 (IDs 445, 446, 447 — "barber3" y "Barbero de Test")

### Formulario Renderizado (V5 Público)
* **Cantidad**: 2 barberos activos.
* **Coincidencia**: Coinciden exactamente. No se muestran administradores ni barberos inactivos.

---

## 9. Resultado Horarios: Fuente vs Formulario

### Fuente de Verdad (PostgreSQL)
* **Días activos en DB**: Todos los días están activos.
* **Horas registradas**:
  * Domingo (0): 08:00 - 20:30
  * Lunes (1): 08:00 - 20:00
  * Martes (2) a Sábado (6): 08:00 - 20:30

### Formulario Renderizado (V5 Público)
* **Días mostrados**: Todos los días están disponibles para la selección.
* **Respeto a horarios**: Se respetan las horas específicas recuperadas de la DB (Lunes cierra a las 20:00, el resto de días a las 20:30). No se usa fallback genérico de `9:00 - 19:00`.

---

## 10. Payload Real de Reserva
La reserva de prueba realizada registró el siguiente payload en la llamada de red:

```json
{
  "barberia_id": 198,
  "slug": "barberia-prueba-4",
  "servicio_id": 489,
  "barbero_id": 439,
  "fecha": "2026-06-25T00:00:00.000Z",
  "hora_inicio": "12:00:00",
  "cliente_nombre": "QA Antigravity Test",
  "cliente_tel": "3101112222"
}
```

* **Validación**:
  * `barberia_id` es el ID real (198).
  * `servicio_id` es el ID real del servicio (489) y no un índice `idx + 1`.
  * `barbero_id` es el ID real del barbero (439) y no un índice `idx + 1`.

---

## 11. Resultado Dashboard
* **Persistencia**: La cita de prueba con ID `194` quedó correctamente registrada en la tabla `public.citas` de la base de datos de PostgreSQL.
* **Visualización**: La cita es hidratada y listada correctamente en las métricas y el historial de citas del dashboard del comercio.

---

## 12. Errores de Consola
* **Resultado**: Ninguno. La consola del navegador carga sin advertencias de sintaxis o errores en la carga de dependencias de la página.

---

## 13. Errores de Network
* **Resultado**: Ninguno. Las peticiones REST hacia la API y los webhooks en n8n responden exitosamente con código `200 OK`.

---

## 14. Decisión Final

### **BUG SIGUE ABIERTO CON EVIDENCIA**

#### **Causa y Evidencia**
El código funcional de los templates locales y del editor corrige el 100% de los problemas de placeholders e imágenes perdidas. Sin embargo, **las páginas de WordPress no han sido actualizadas con este código**. La página física `/index_unico_v5_1_azul_rojo_elegante/` devuelve el HTML antiguo sin las funciones `isKnownPlaceholderImage` y `resolveServiceImage`, impidiendo que el fix se refleje en producción para los usuarios finales.

#### **Fix Mínimo Recomendado**
1. **Copiar** el contenido completo del archivo local [index_unico_v5_1_azul_rojo_elegante.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html).
2. **Pegar** este código en la página física correspondiente de WordPress con slug `index_unico_v5_1_azul_rojo_elegante`.
3. **Copiar** el contenido del archivo local [landing_editor_v2_unico_vscode.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/editor/landing_editor_v2_unico_vscode.html).
4. **Pegar** este código en la página de WordPress para el editor `landing_editor_v2`.
5. Una vez realizado, se debe volver a correr la prueba de caché para confirmar la desaparición de los placeholders de Unsplash.
