# Plan de Corrección de Bloqueadores (PR #1): Fase 1 (Identidad y Secretos)

Este documento detalla el plan de corrección para los bloqueadores de seguridad y arquitectura identificados en la Pull Request #1, enfocándose exclusivamente en **BLOCKER-01** y **BLOCKER-04**.

---

## 1. BLOCKER-01: Identidad del Propietario Controlada por el Cliente

### Problema:
El endpoint de creación de checkout de Sandbox (`prepaid-checkout`) recibía los parámetros `user_id` y `barberia_id` directamente en el cuerpo del request HTTP POST enviado por el cliente. Adicionalmente, el workflow de n8n ejecutaba un bloque `SET request.jwt.claims` impersonando al usuario suministrado por el frontend, utilizando además un fallback predeterminado (`|| 10`). Esto permitía la suplantación de identidad multi-inquilino (Cross-Tenant Identity Spoofing) en el lado del cliente.

### Solución Diseñada:
1. **Eliminar entrada del cliente:** Remover por completo el parámetro `user_id` del cuerpo del request HTTP POST en el frontend ([registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html)).
2. **Validar Token JWT en n8n:**
   * Modificar el workflow [BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX.json](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/n8n/workflows/sandbox/BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX.json) para interceptar los encabezados de la petición (cookies o cabecera `Authorization: Bearer <JWT>`).
   * Extraer el token de sesión (`ba_session`).
   * Validar la firma digital del JWT usando una clave simétrica (`HS256`) a través de un nodo nativo de verificación de JWT de n8n.
   * Si la sesión no es válida, la petición debe responder de inmediato con un código **401 Unauthorized** y abortar, previniendo cualquier acceso a PostgreSQL.
   * Extraer el ID de usuario autenticado del payload verificado del token.
3. **Impersonación Segura en BD:** Utilizar únicamente el ID de usuario resuelto y verificado por la firma del token JWT para inyectar en las variables de sesión de Postgres (`SET request.jwt.claims`).
4. **Eliminación de Fallbacks:** Quitar los fallbacks `|| 10` de la consulta SQL del nodo Postgres. Si el ID de barbería o el ID de usuario no están presentes, la consulta fallará de forma controlada.
5. **Rol de Base de Datos Restringido:** Configurar n8n para conectarse a PostgreSQL usando un rol de base de datos específico no superusuario y que respete RLS (`n8n_billing_worker`).

---

## 2. BLOCKER-04: Token / API Key de n8n Literal Versionado

### Problema:
Varios scripts experimentales de depuración y migración de base de datos bajo el directorio `pruebas/` contenían la clave API de n8n expuesta de manera literal en texto plano en la variable `const token = 'eyJhbGci...'`.

### Solución Diseñada:
1. **Sanitización del Código:** Reemplazar todas las definiciones del token de la API de n8n por la variable de entorno `process.env.N8N_API_KEY`.
2. **Control Fail-Closed:** Insertar un validador en los scripts que verifique la existencia de dicha variable de entorno y aborte de inmediato si no se detecta, evitando cualquier petición de red externa:
   ```javascript
   const token = process.env.N8N_API_KEY;
   if (!token) {
     console.error("N8N_API_KEY is required.");
     process.exit(1);
   }
   ```
3. **Gestión de Entorno:**
   * Crear el archivo [.env.example](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/.env.example) para declarar la variable requerida.
   * Asegurar que las reglas de exclusión en [.gitignore](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/.gitignore) oculten los archivos `.env` y `.env.*` reales del árbol de Git, exceptuando `.env.example`.
4. **Verificación de Seguridad:** Ejecutar herramientas de escaneo en la rama para asegurar que el token histórico no figure en las diferencias de archivos.
5. **Recomendación Administrativa:** Marcar la clave de la API de n8n comprometida en el historial como revocada/pendiente de rotación en la consola de administración de n8n.
