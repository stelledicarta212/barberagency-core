# Aseguramiento de Calidad (QA) — BarberAgency

Bienvenido a la estructura centralizada de QA para la plataforma **BarberAgency**. Esta carpeta define el marco de pruebas, validaciones y reportes para asegurar la integridad, aislamiento multi-tenant y correcto funcionamiento de la lógica de negocio y las plantillas visuales.

## 🎯 Propósito de esta Carpeta
Esta carpeta centraliza el contexto vivo de pruebas, los planes de validación (unitarios, Postman, E2E), los checklists de activación y la bitácora de reportes de QA por fase. 

> [!IMPORTANT]
> **El proceso de QA es estrictamente OBLIGATORIO antes de cualquier despliegue a producción.** Ningún cambio sensible o funcional puede ser promovido sin su respectiva validación y reporte firmado.

---

## 🚦 Guardarraíles y Reglas para Agentes de IA
Como agente que opera en este workspace, debes adherirte a las siguientes normas:
1. **Evidencia Obligatoria**: Cada agente que realice modificaciones en el código funcional debe dejar evidencia explícita en su respectivo reporte de QA.
2. **Cobertura de Pruebas**: Las pruebas deben cubrir:
   - **Pruebas Unitarias**: Validación de funciones puras, helpers CLI y normalizadores.
   - **Pruebas de Integración y API**: Cobertura de endpoints y flujos de n8n / PostgREST mediante Postman.
   - **Pruebas Visuales y E2E**: Comprobación del renderizado de componentes y navegación en móvil/desktop.
   - **Seguridad**: Validación estricta de aislamiento multi-tenant (RLS) y protección de endpoints administrativos.
   - **Rollback**: Verificación de planes de retorno rápido a un estado estable en caso de fallos.
3. **No Bypass**: Ningún cambio pasa directo a producción sin registrarse en `qa/reports/`.

---

## 📁 Estructura del Directorio
* **[QA_CONTEXT.md](file:///root/github/barberagency-core/qa/QA_CONTEXT.md)**: El manifiesto y estado vivo del runtime de plantillas, variables y reglas de QA.
* **[CHECKLIST_TEMPLATE_RUNTIME.md](file:///root/github/barberagency-core/qa/CHECKLIST_TEMPLATE_RUNTIME.md)**: La lista de chequeo obligatoria para la activación de nuevas plantillas o cambios en el core visual.
* **[unit/](file:///root/github/barberagency-core/qa/unit/)**: Planes de prueba unitaria para helpers CLI (`wp-config-helper.php`), descarga de plantillas (`sync-templates.php`) y del parser del runtime.
* **[postman/](file:///root/github/barberagency-core/qa/postman/)**: Colecciones y variables para la validación automática de API y respuesta de plantillas HTTP.
* **[e2e/](file:///root/github/barberagency-core/qa/e2e/)**: Planes de validación de extremo a extremo, pruebas visuales y comportamiento responsivo.
* **[reports/](file:///root/github/barberagency-core/qa/reports/)**: Registro de resultados e históricos de QA por fases de despliegue.
