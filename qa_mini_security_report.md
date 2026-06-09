# Reporte Final de Mini Prueba de Seguridad — Usuarios y Accesos

* **Fecha de Ejecución**: 2026-06-09T23:51:26.414Z
* **Fase**: Validación Final de Producción/QA

## 1. Tabla de Resultados PASS/FAIL

| ID | Prueba de Validación | Estatus | Evidencia SQL | Evidencia HTTP |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Owner/admin entra a barbería autorizada | **PASS** | `SELECT owner_id FROM public.barberias WHERE id = 198; -> owner_id: 7` | GET /api/dashboard/state?barberia_id=198 -> HTTP 200 (Nombre: "Barberia Prueba 4") |
| 2 | Cambiar email_contacto de la barbería (Acceso NO cambia) | **PASS** | `UPDATE public.barberias SET email_contacto = 'qa-malicious-attacker@domain.com' WHERE id = 198;` | GET /api/dashboard/state?barberia_id=198 after email change -> HTTP 200 (Acceso mantenido: true) |
| 3 | Usuario no miembro intenta entrar | **PASS** | `INSERT INTO public.usuarios (email, role) VALUES ('non-member-test@barberagency.com', 'admin'); (No miembro)` | Login HTTP: 403, Login Status: "forbidden", State HTTP: 401 |
| 4 | Usuario con role NULL (Default a guest/blocked, nunca admin) | **PASS** | `INSERT INTO public.usuarios (email, role) VALUES ('null-role-test@barberagency.com', NULL);` | Login HTTP: 401, Login Status: "invalid_credentials", State HTTP: 401 |
| 5 | session/me lista solo barberías autorizadas | **PASS** | `SELECT id FROM public.barberias WHERE owner_id = 7; -> Esperados: [189, 190, 191, 192, 193, 196, 197, 198]` | GET /api/session/me -> HTTP 200, Retornados: [189, 190, 191, 192, 193, 196, 197, 198] |
| 6 | dashboard/state rechaza barbería ajena | **PASS** | `SELECT id FROM public.barberias WHERE id = 3 AND owner_id = 7; -> No matches` | GET /api/dashboard/state?barberia_id=3 -> HTTP 403 (Mensaje: "No tienes permisos para esta barberia o no existe") |

## 2. Riesgos Abiertos Residuales
1. **Sincronización por Correo de Barberos**: Tal como se diagnosticó en la auditoría, si un administrador agrega un barbero comercial utilizando el correo de un usuario existente, la base de datos enlaza la fila de `barberos` con ese `usuario_id` sin validar. Se acordó mitigar esto en el diseño del nuevo flujo de invitación asíncrona.
2. **Dependencias Locales**: Se requiere eliminar los archivos residuales temporales en la carpeta `scratch` y mantener un monitoreo sobre las llamadas del proxy.

## 3. Conclusión
Todos los flujos de autorización críticos han quedado completamente desacoplados de `email_contacto` y protegidos contra accesos con roles vacíos/promovidos. El sistema se comporta de acuerdo con el modelo de privilegios mínimos esperado en producción.
