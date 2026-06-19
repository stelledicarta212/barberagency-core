# QA Context — BarberAgency

Este documento contiene el estado vivo de validación del proyecto, la infraestructura relevante, la configuración de flags activos y las directrices para la gestión de riesgos y rollback.

---

## 📍 Estado Actual Validado
El estado de las versiones de plantillas y su mecanismo de renderizado actual es el siguiente:

*   **V2**: `physical_registry` (Activo y Validado)
*   **V3**: `physical_registry` (Activo y Validado)
*   **V4**: `physical_registry` (Activo y Validado)
    *   **URL Validada**: [https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-150](https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-150)
    *   **Resultado de Validación**:
        *   HTTP 200 OK
        *   Runtime: `physical_registry`
        *   Template-Id: `v4`
        *   Logo visible
        *   Servicios visibles
        *   Barberos visibles
        *   Fotos cargadas
        *   Sin errores JS críticos
*   **V5**: `legacy` / Pendiente de Activación (Fase 6D)
*   **V6**: Pendiente / Sin activar
*   **V7**: Pendiente / Sin activar

---

## 🛡️ Seguridad Validada (Versión 0.5.0-v5)
*   **ba_ping**: OK (Versión `0.5.0-v5`)
*   **Protección**: Endpoints sensibles HTTP bloqueados externamente.
*   **Robustez**: Sin errores HTTP 500 ni loops de redirección detectados.
*   **Integridad**: n8n y Base de Datos (PostgreSQL) intactas.

---

## 🛠️ Infraestructura Relevante
Los siguientes archivos y rutas en el servidor WordPress (`/code`) son clave para el funcionamiento del enrutador de plantillas:

*   **Directorio WordPress real**: `/code`
*   **Archivo wp-config.php**: `/code/wp-config.php`
*   **Plugin activo**: `/code/wp-content/plugins/barberagency-public-router-v5-flat`
*   **Helper CLI**: `/code/wp-content/plugins/barberagency-public-router-v5-flat/wp-config-helper.php`
*   **Sync CLI**: `/code/wp-content/plugins/barberagency-public-router-v5-flat/sync-templates.php`

---

## ⚙️ Flags Esperados Actuales
Variables constantes definidas en la configuración del entorno o inyectadas en `wp-config.php`:

*   `BA_TEMPLATE_RUNTIME_ENABLED=true`
*   `BA_TEMPLATE_RUNTIME_ALLOWED_TEMPLATES=v2,v3,v4`
*   `BA_TEMPLATE_RUNTIME_FALLBACK_ENABLED=true`

---

## 🤖 Reglas de Agentes
Cada agente que realice cualquier modificación en el sistema debe documentar obligatoriamente en su reporte o en la bitácora diaria:

1.  **Qué cambió**: Descripción clara del código o configuración modificada.
2.  **Qué riesgo creó**: Análisis de regresión o potenciales fallos en cascada.
3.  **Cómo se prueba**: Pasos exactos y reproducibles para verificar la funcionalidad.
4.  **Cómo se revierte**: Comando de rollback exacto para retornar al estado previo seguro.

---

## 📐 Rol de los Agentes en QA
*   **Arquitecto**: Asegurar el desacoplamiento entre el backend de WordPress, el panel Next.js y PostgreSQL, y verificar que no se eludan las reglas de red.
*   **Database**: Validar que ninguna consulta o modificación de esquema bypassée RLS y que todas las llamadas respeten el aislamiento multi-tenant.
*   **Backend / Runtime**: Garantizar la consistencia transaccional, el correcto enrutamiento del Same-Origin Proxy de Next.js, la validez lógica del motor de plantillas y los flujos de n8n.
*   **Frontend / Templates**: Validar la fidelidad del renderizado visual en móvil/desktop, la correcta hidratación del seed y el comportamiento responsivo.
*   **DevOps**: Controlar la infraestructura de contenedores, la inyección segura de variables de entorno y asegurar que los scripts de sincronización mantengan los permisos adecuados.
*   **QA / Testing**: Actúa como filtro obligatorio antes de aprobar producción. Debe ejecutar o coordinar pruebas unitarias, de integración, Postman/API, E2E visual, seguridad, smoke tests y rollback. Su salida debe terminar con un veredicto explícito "PASS" o "BLOCKED", evidencia de headers, resultados visuales/DOM, errores detectados y planes de rollback.


---

## ↩️ Rollback para Fase 6D
Si se detecta cualquier anomalía tras la activación de V5 o cualquier otra plantilla, se debe ejecutar inmediatamente el siguiente comando CLI para restablecer el estado seguro validado (V2, V3 y V4):

```bash
php /code/wp-content/plugins/barberagency-public-router-v5-flat/wp-config-helper.php setup v2,v3,v4
```

---

## 🚀 Próxima Fase Pendiente
*   **Fase 6D — Activación controlada de V5**: Habilitación de la plantilla V5 (Prestigio Ejecutivo) mediante la actualización de `BA_TEMPLATE_RUNTIME_ALLOWED_TEMPLATES` e hidratación desde la fuente de verdad.
