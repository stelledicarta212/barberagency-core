# Plan de Validación E2E — Template Runtime

Este plan de pruebas describe el flujo estructurado de validación de extremo a extremo (E2E) y control visual de regresiones en las páginas públicas de BarberAgency.

> [!WARNING]
> **REGLA CRÍTICA**: Estas validaciones son estrictamente observacionales y de lectura. **No se debe modificar producción** ni alterar configuraciones de EasyPanel durante la ejecución de este plan.

---

## 🔄 Flujo E2E de Validación Visual

### Paso 1: Apertura de Landings
El agente o tester debe abrir secuencialmente las URLs públicas de prueba correspondientes a cada versión de plantilla activa en el navegador:
- **V2**: `https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-prueba-4` (o tenant equivalente).
- **V3**: `https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-167`.
- **V4**: `https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-150`.
- **V5**: `https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-129` (validar que resuelva en legacy).

### Paso 2: Captura de Screenshots (Evidencia)
Para cada una de las URLs probadas, se deben capturar y documentar las siguientes vistas:
1.  **Vista Desktop (1920x1080)**: Validar la disposición de la cabecera (Header Glass), alineación de columnas de servicios y el fondo del hero.
2.  **Vista Mobile (375x812 - Emulación de iPhone X o similar)**: Validar que no existan desbordamientos horizontales, solapamiento de textos ni scrolls infinitos.

### Paso 3: Inspección de Consola y Red
*   **Console Errors**: Abrir la consola de desarrollo (F12) y comprobar que no existan excepciones JavaScript críticas (`TypeError`, `ReferenceError`, recursos rotos 404).
*   **Verificación de Headers**: Utilizar la pestaña Network para validar que la respuesta HTTP contenga los headers esperados:
    - `X-BarberAgency-Runtime: physical_registry`
    - `X-BarberAgency-Template-Id: v2|v3|v4`

### Paso 4: Auditoría del DOM e Hidratación
Verificar que la inyección de datos proveniente de PostgreSQL (a través de la hidratación de la base de verdad) se dibuje correctamente en el DOM:
1.  **Logo**: El elemento de imagen del logotipo (`<img>`) debe contener la URL saneada de R2 y no el placeholder por defecto de Unsplash.
2.  **Colección de Servicios**: Los servicios deben listarse en sus cajas correspondientes con nombre y precio correctos.
3.  **Colección de Barberos**: Los barberos activos deben tener su avatar/foto cargados correctamente.

### Paso 5: Generación del Reporte
Una vez finalizados los pasos anteriores, se debe compilar y escribir el reporte en formato Markdown dentro de `qa/reports/` con la estructura oficial, marcando el estatus final de la fase como **PASS** o **FAIL/BLOCKED**.
