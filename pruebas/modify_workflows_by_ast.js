const fs = require('fs');
const path = require('path');

const targetQueries = {
  'login_workflow.json': {
    nodeId: 'pg-login',
    query: `
            WITH input AS (
              SELECT
                NULLIF(lower(trim($1::text)), '') AS email_in,
                NULLIF($2::text, '') AS password_in,
                NULLIF(trim($3::text), '') AS slug_in,
                $4::int AS barberia_id_in
            ),
            target_barberia AS (
              SELECT b.*
              FROM public.barberias b
              JOIN input i ON (b.id = i.barberia_id_in OR b.slug = i.slug_in)
              WHERE b.deleted_at IS NULL
              ORDER BY b.id DESC
              LIMIT 1
            ),
            auth_user AS (
              SELECT u.id, u.nombre, u.email, u.role
              FROM public.usuarios u
              JOIN input i ON lower(u.email) = i.email_in
              WHERE i.password_in IS NOT NULL
                AND u.password_hash IS NOT NULL
                AND public.fn_password_verify(i.password_in, u.password_hash) = true
              LIMIT 1
            ),
            barber_match AS (
              SELECT b.id AS barbero_id, b.nombre AS barbero_nombre
              FROM public.barberos b
              JOIN target_barberia tb ON tb.id = b.barberia_id
              JOIN auth_user u ON u.id = b.usuario_id
              WHERE b.activo = true
              LIMIT 1
            ),
            resolved AS (
              SELECT
                tb.id AS barberia_id,
                tb.slug,
                tb.nombre AS barberia_nombre,
                tb.owner_id,
                tb.email_contacto,
                u.id AS user_id,
                u.nombre AS user_nombre,
                u.email,
                COALESCE(NULLIF(u.role, ''), 'admin') AS db_role,
                bm.barbero_id,
                bm.barbero_nombre,
                CASE
                  WHEN u.id IS NULL THEN 'invalid_credentials'
                  WHEN tb.id IS NULL THEN 'barberia_not_found'
                  WHEN COALESCE(NULLIF(u.role, ''), 'admin') IN ('admin', 'owner', 'super_admin')
                    AND (
                      tb.owner_id = u.id OR 
                      EXISTS (
                        SELECT 1 FROM public.barberia_miembros m 
                        WHERE m.barberia_id = tb.id 
                          AND (m.usuario_id = u.id OR lower(m.email) = lower(u.email)) 
                          AND m.rol IN ('owner', 'admin', 'super_admin')
                          AND m.activo = true
                      )
                    )
                    THEN 'allowed_admin'
                  WHEN COALESCE(NULLIF(u.role, ''), 'admin') = 'barbero' AND (
                    bm.barbero_id IS NOT NULL OR
                    EXISTS (
                      SELECT 1 FROM public.barberia_miembros m 
                      WHERE m.barberia_id = tb.id 
                        AND (m.usuario_id = u.id OR lower(m.email) = lower(u.email)) 
                        AND m.rol = 'barbero'
                        AND m.activo = true
                    )
                  )
                    THEN 'allowed_barbero'
                  WHEN COALESCE(NULLIF(u.role, ''), 'admin') = 'cajero' AND (
                    tb.owner_id = u.id OR 
                    bm.barbero_id IS NOT NULL OR
                    EXISTS (
                      SELECT 1 FROM public.barberia_miembros m 
                      WHERE m.barberia_id = tb.id 
                        AND (m.usuario_id = u.id OR lower(m.email) = lower(u.email)) 
                        AND m.rol IN ('owner', 'admin', 'cajero')
                        AND m.activo = true
                    )
                  )
                    THEN 'allowed_cajero'
                  ELSE 'forbidden'
                END AS access_status
              FROM input i
              LEFT JOIN target_barberia tb ON true
              LEFT JOIN auth_user u ON true
              LEFT JOIN barber_match bm ON true
            )
            SELECT json_build_object(
              'ok', access_status IN ('allowed_admin', 'allowed_barbero', 'allowed_cajero'),
              'status', access_status,
              'identity', json_build_object('barberia_id', barberia_id, 'slug', slug),
              'user', json_build_object('id', user_id, 'nombre', user_nombre, 'email', email, 'role', db_role, 'barbero_id', barbero_id),
              'role', CASE
                WHEN access_status = 'allowed_admin' THEN 'admin'
                WHEN access_status = 'allowed_barbero' THEN 'barbero'
                WHEN access_status = 'allowed_cajero' THEN 'cajero'
                ELSE db_role
              END,
              'message', CASE
                WHEN access_status = 'invalid_credentials' THEN 'Credenciales invalidas'
                WHEN access_status = 'barberia_not_found' THEN 'Barberia no encontrada'
                WHEN access_status = 'forbidden' THEN 'Usuario sin acceso a esta barberia'
                ELSE 'Login correcto'
              END
            ) AS result
            FROM resolved;
    `
  },
  'session_me_workflow.json': {
    nodeId: 'db859604-6a11-4d0c-b32f-f409ce0256af',
    query: `
WITH input AS (
  SELECT
    COALESCE($1::boolean, false) AS auth_ok,
    COALESCE($2::int, 0) AS user_id_in,
    NULLIF(trim(COALESCE($3::text, '')), '') AS message_in,
    COALESCE(NULLIF(trim($4::text), ''), 'https://barberagency-barberagency.gymh5g.easypanel.host') AS cors_origin
),
resolved AS (
  SELECT u.id AS user_id, u.email, u.nombre, u.plan_id
  FROM public.usuarios u
  JOIN input i ON u.id = i.user_id_in
  LIMIT 1
),
owned_barberias AS (
  SELECT DISTINCT ON (b.id)
    b.id,
    b.slug,
    b.nombre,
    x.role
  FROM public.barberias b
  JOIN resolved r ON true
  JOIN LATERAL (
    SELECT 'owner'::text AS role WHERE b.owner_id = r.user_id
    UNION ALL
    SELECT bm.rol::text AS role FROM public.barberia_miembros bm
    WHERE bm.barberia_id = b.id 
      AND (bm.usuario_id = r.user_id OR lower(bm.email) = lower(r.email))
      AND bm.activo = true
  ) x ON true
  WHERE b.deleted_at IS NULL
  ORDER BY b.id DESC, CASE x.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'barbero' THEN 3 WHEN 'cajero' THEN 4 ELSE 5 END ASC
),
current_barberia AS (
  SELECT *
  FROM owned_barberias
  ORDER BY id DESC
  LIMIT 1
)
SELECT
  CASE WHEN i.auth_ok AND EXISTS (SELECT 1 FROM resolved) THEN true ELSE false END AS ok,
  CASE WHEN i.auth_ok AND EXISTS (SELECT 1 FROM resolved) THEN 200 ELSE 401 END AS status_code,
  CASE WHEN i.auth_ok AND EXISTS (SELECT 1 FROM resolved) THEN NULL ELSE COALESCE(i.message_in, 'Sesion no valida') END AS message,
  i.cors_origin,
  (SELECT user_id FROM resolved LIMIT 1) AS user_id,
  (SELECT email FROM resolved LIMIT 1) AS email,
  (SELECT nombre FROM resolved LIMIT 1) AS nombre,
  (SELECT plan_id FROM resolved LIMIT 1) AS plan_id,
  CASE WHEN (SELECT plan_id FROM resolved LIMIT 1) IS NULL THEN false ELSE true END AS puede_crear_barberia,
  COALESCE((SELECT count(*) FROM owned_barberias), 0)::int AS barberias_count,
  COALESCE((SELECT row_to_json(current_barberia) FROM current_barberia), NULL) AS current_barberia,
  COALESCE((SELECT json_agg(owned_barberias) FROM owned_barberias), '[]'::json) AS barberias
FROM input i;
    `
  },
  'dashboard_state_workflow.json': {
    nodeId: 'session-validate',
    query: `
WITH target_barberia AS (
  SELECT id, slug, owner_id, email_contacto FROM public.barberias
  WHERE (
    ($2::int > 0 AND id = $2::int) OR
    (($2::int IS NULL OR $2::int = 0) AND slug = $3::text)
  ) AND deleted_at IS NULL
),
auth_check AS (
  SELECT id, role, email FROM public.usuarios WHERE id = $1 LIMIT 1
),
barberia_check AS (
  SELECT tb.id FROM target_barberia tb
  LEFT JOIN auth_check ac ON true
  WHERE (
    tb.owner_id = $1 OR
    EXISTS (
      SELECT 1 FROM public.barberia_miembros m 
      WHERE m.barberia_id = tb.id 
        AND (m.usuario_id = $1 OR lower(m.email) = lower(ac.email)) 
        AND m.activo = true
    ) OR
    EXISTS (SELECT 1 FROM public.barberos WHERE usuario_id = $1 AND barberia_id = tb.id)
  )
  AND ($2::int IS NULL OR $2::int = 0 OR tb.slug IS NULL OR $3::text IS NULL OR tb.slug = $3::text)
  LIMIT 1
)
SELECT
  $4::boolean AS auth_ok_jwt,
  EXISTS (SELECT 1 FROM auth_check) AS auth_ok,
  EXISTS (SELECT 1 FROM barberia_check) AS barberia_ok,
  COALESCE(
    (SELECT role FROM auth_check) IN ('admin', 'owner', 'super_admin', 'barbero', 'cajero'),
    false
  ) AS role_ok,
  (SELECT id FROM target_barberia LIMIT 1) AS validated_barberia_id,
  (SELECT role FROM auth_check) AS user_role;
    `
  },
  'config_update_workflow.json': {
    nodeId: 'pg-update',
    query: `
WITH input AS (
  SELECT
    $1::int AS user_id,
    COALESCE($2::boolean, false) AS auth_ok_jwt,
    $3::int AS barberia_id,
    NULLIF(trim($4::text), '') AS slug,
    lower(NULLIF(trim($5::text), '')) AS mode,
    COALESCE($6::jsonb, '{}'::jsonb) AS barberia,
    COALESCE($7::jsonb, '[]'::jsonb) AS servicios,
    COALESCE($8::jsonb, '[]'::jsonb) AS barberos,
    COALESCE($9::jsonb, '[]'::jsonb) AS horarios,
    COALESCE($10::jsonb, '{}'::jsonb) AS admin
),
target AS (
  SELECT b.*
  FROM public.barberias b, input i
  WHERE b.id = i.barberia_id
    AND b.deleted_at IS NULL
  LIMIT 1
),
auth_check AS (
  SELECT u.id, u.role, u.email
  FROM public.usuarios u, input i
  WHERE u.id = i.user_id
  LIMIT 1
),
validation AS (
  SELECT
    i.*,
    t.id AS target_id,
    t.slug AS target_slug,
    t.owner_id AS original_owner_id,
    ac.role AS user_role,
    CASE
      WHEN NOT i.auth_ok_jwt OR ac.id IS NULL THEN 'sesion_no_valida'
      WHEN i.mode <> 'edit' THEN 'modo_invalido'
      WHEN i.barberia_id <= 0 OR i.slug IS NULL THEN 'datos_invalidos'
      WHEN t.id IS NULL THEN 'barberia_no_encontrada'
      WHEN t.slug IS DISTINCT FROM i.slug THEN 'slug_mismatch'
      WHEN NOT (
        t.owner_id = i.user_id 
        OR ac.role = 'super_admin' 
        OR EXISTS (
          SELECT 1 FROM public.barberia_miembros m 
          WHERE m.barberia_id = t.id 
            AND (m.usuario_id = i.user_id OR lower(m.email) = lower(ac.email)) 
            AND m.rol IN ('owner', 'admin', 'super_admin')
            AND m.activo = true
        )
      ) THEN 'sin_permiso'
      WHEN COALESCE(jsonb_array_length(i.servicios), 0) = 0 THEN 'servicios_invalidos'
      WHEN COALESCE(jsonb_array_length(i.horarios), 0) = 0 THEN 'horarios_invalidos'
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(i.barberos) nb(value)
        WHERE COALESCE(NULLIF(nb.value->>'id', '')::int, 0) = 0
          AND (
            NULLIF(btrim(nb.value->>'email'), '') IS NULL OR
            NULLIF(btrim(nb.value->>'password'), '') IS NULL OR
            length(btrim(nb.value->>'password')) < 6
          )
      ) THEN 'credenciales_barbero_nuevo_invalidas'
      ELSE 'ok'
    END AS code
  FROM input i
  LEFT JOIN target t ON true
  LEFT JOIN auth_check ac ON true
),
updated_barberia AS (
  UPDATE public.barberias b
  SET
    nombre = COALESCE(NULLIF(trim(v.barberia->>'nombre'), ''), b.nombre),
    telefono = NULLIF(trim(v.barberia->>'telefono'), ''),
    direccion = NULLIF(trim(v.barberia->>'direccion'), ''),
    ciudad = NULLIF(trim(v.barberia->>'ciudad'), ''),
    politicas = NULLIF(trim(v.barberia->>'politicas'), ''),
    slot_min = CASE
      WHEN COALESCE((v.barberia->>'slot_min')::int, b.slot_min) IN (5, 10, 15, 20, 30)
        THEN COALESCE((v.barberia->>'slot_min')::int, b.slot_min)
      ELSE b.slot_min
    END
  FROM validation v
  WHERE v.code = 'ok'
    AND b.id = v.target_id
  RETURNING b.id, b.nombre, b.slug, b.telefono, b.direccion, b.ciudad, b.politicas, b.slot_min, b.owner_id
),
sync_catalogs AS (
  SELECT
    CASE WHEN v.code = 'ok'
      THEN public.ba_sync_publicacion_collections(v.target_id, v.servicios, v.barberos)
      ELSE NULL::jsonb
    END AS result
  FROM validation v
),
sync_hours AS (
  SELECT
    CASE WHEN v.code = 'ok'
      THEN public.ba_sync_registro_horarios(v.target_id, v.horarios)
      ELSE NULL::jsonb
    END AS result
  FROM validation v
),
new_barber_access AS (
  SELECT
    v.target_id AS barberia_id,
    NULLIF(btrim(item.value->>'nombre'), '') AS nombre,
    lower(NULLIF(btrim(item.value->>'email'), '')) AS email,
    NULLIF(btrim(item.value->>'password'), '') AS password
  FROM validation v
  CROSS JOIN LATERAL jsonb_array_elements(v.barberos) item(value)
  WHERE v.code = 'ok'
    AND COALESCE(NULLIF(item.value->>'id', '')::int, 0) = 0
    AND NULLIF(btrim(item.value->>'nombre'), '') IS NOT NULL
    AND NULLIF(btrim(item.value->>'email'), '') IS NOT NULL
    AND NULLIF(btrim(item.value->>'password'), '') IS NOT NULL
),
existing_new_users AS (
  SELECT nba.nombre, nba.email, u.id AS user_id
  FROM new_barber_access nba
  JOIN public.usuarios u ON lower(u.email) = nba.email
),
inserted_new_users AS (
  INSERT INTO public.usuarios (nombre, email, password_hash, role)
  SELECT
    nba.nombre,
    nba.email,
    crypt(nba.password, gen_salt('bf', 8)),
    'barbero'
  FROM new_barber_access nba
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE lower(u.email) = nba.email
  )
  RETURNING id AS user_id, nombre, email
),
resolved_new_users AS (
  SELECT user_id, nombre, email FROM existing_new_users
  UNION ALL
  SELECT user_id, nombre, email FROM inserted_new_users
),
linked_new_barbers AS (
  UPDATE public.barberos br
  SET usuario_id = rnu.user_id
  FROM resolved_new_users rnu, validation v
  WHERE v.code = 'ok'
    AND br.barberia_id = v.target_id
    AND lower(btrim(br.nombre)) = lower(btrim(rnu.nombre))
    AND br.usuario_id IS NULL
  RETURNING br.id, br.usuario_id
)
SELECT
  CASE WHEN v.code = 'ok' THEN true ELSE false END AS ok,
  CASE WHEN v.code = 'ok' THEN 'configuracion_actualizada' ELSE v.code END AS code,
  CASE
    WHEN v.code = 'ok' THEN 'Configuracion actualizada'
    WHEN v.code = 'sesion_no_valida' THEN 'Sesion no valida'
    WHEN v.code = 'sin_permiso' THEN 'No tienes permisos para editar esta barberia'
    WHEN v.code = 'slug_mismatch' THEN 'El slug no coincide con la barberia solicitada'
    WHEN v.code = 'barberia_no_encontrada' THEN 'Barberia no encontrada'
    WHEN v.code = 'credenciales_barbero_nuevo_invalidas' THEN 'Los barberos nuevos requieren email valido y password de minimo 6 caracteres'
    ELSE 'Datos invalidos'
  END AS message,
  CASE WHEN v.code = 'ok' THEN 200 WHEN v.code = 'sesion_no_valida' THEN 401 WHEN v.code IN ('sin_permiso', 'slug_mismatch') THEN 403 ELSE 400 END AS status_code,
  CASE WHEN v.code = 'ok'
    THEN jsonb_build_object(
      'barberia', COALESCE(to_jsonb(ub), '{}'::jsonb),
      'catalogs', (SELECT result FROM sync_catalogs LIMIT 1),
      'hours', (SELECT result FROM sync_hours LIMIT 1),
      'new_barber_users_linked', (SELECT count(*) FROM linked_new_barbers),
      'owner_id_original', v.original_owner_id,
      'owner_id_actual', COALESCE(ub.owner_id, v.original_owner_id)
    )
    ELSE NULL::jsonb
  END AS data
FROM validation v
LEFT JOIN updated_barberia ub ON true;
    `
  },
  'barberos_workflow.json': {
    nodeId: 'session-validate',
    query: `
WITH target_barberia AS (
  SELECT COALESCE(
    NULLIF($2::int, 0),
    (SELECT barberia_id FROM public.barberos WHERE id = $3::int LIMIT 1)
  ) AS id
),
auth_check AS (
  SELECT id FROM public.usuarios WHERE id = $1 LIMIT 1
),
barberia_check AS (
  SELECT b.id FROM public.barberias b
  JOIN target_barberia tb ON b.id = tb.id
  WHERE (
    b.owner_id = $1 
    OR EXISTS (
      SELECT 1 FROM public.barberia_miembros m 
      WHERE m.barberia_id = b.id 
        AND m.usuario_id = $1 
        AND m.rol IN ('owner', 'admin')
        AND m.activo = true
    )
  ) AND b.deleted_at IS NULL LIMIT 1
),
barbero_check AS (
  SELECT 1 WHERE $3::int IS NULL OR $3::int = 0 OR EXISTS (
    SELECT 1 FROM public.barberos b
    JOIN target_barberia tb ON b.barberia_id = tb.id
    WHERE b.id = $3::int
  )
)
SELECT
  $4::boolean AS auth_ok_jwt,
  EXISTS (SELECT 1 FROM auth_check) AS auth_ok,
  EXISTS (SELECT 1 FROM barberia_check) AS barberia_ok,
  EXISTS (SELECT 1 FROM barbero_check) AS barbero_ok;
    `
  },
  'citas_workflow.json': {
    nodeId: 'session-validate',
    query: `
WITH auth_check AS (
  SELECT id FROM public.usuarios WHERE id = $1 LIMIT 1
),
barberia_check AS (
  SELECT id FROM public.barberias 
  WHERE id = $2 AND (
    owner_id = $1 
    OR EXISTS (
      SELECT 1 FROM public.barberia_miembros m 
      WHERE m.barberia_id = $2 
        AND m.usuario_id = $1 
        AND m.rol IN ('owner', 'admin')
        AND m.activo = true
    )
  ) AND deleted_at IS NULL LIMIT 1
),
barbero_check AS (
  SELECT 1 WHERE $5::int IS NULL OR EXISTS (
    SELECT 1 FROM public.barberos WHERE id = $5::int AND barberia_id = $2
  )
),
servicio_check AS (
  SELECT 1 WHERE $6::int IS NULL OR EXISTS (
    SELECT 1 FROM public.servicios WHERE id = $6::int AND barberia_id = $2
  )
),
cita_check AS (
  SELECT 1 WHERE $3::text = 'add_cita' OR EXISTS (
    SELECT 1 FROM public.citas WHERE id = $4::int AND barberia_id = $2
  )
)
SELECT
  $7::boolean AS auth_ok_jwt,
  EXISTS (SELECT 1 FROM auth_check) AS auth_ok,
  EXISTS (SELECT 1 FROM barberia_check) AS barberia_ok,
  EXISTS (SELECT 1 FROM barbero_check) AS barbero_ok,
  EXISTS (SELECT 1 FROM servicio_check) AS servicio_ok,
  EXISTS (SELECT 1 FROM cita_check) AS cita_ok;
    `
  },
  'servicios_workflow.json': {
    nodeId: 'db859604-6a11-4d0c-b32f-f409ce0256af',
    query: `
WITH auth_check AS (
  SELECT id FROM public.usuarios WHERE id = $1 LIMIT 1
),
barberia_check AS (
  SELECT id FROM public.barberias 
  WHERE id = $2 AND (
    owner_id = $1 
    OR EXISTS (
      SELECT 1 FROM public.barberia_miembros m 
      WHERE m.barberia_id = $2 
        AND m.usuario_id = $1 
        AND m.rol IN ('owner', 'admin')
        AND m.activo = true
    )
  ) AND deleted_at IS NULL LIMIT 1
),
servicio_check AS (
  SELECT 1
  WHERE $3::text = 'add_servicio' OR EXISTS (
    SELECT 1 FROM public.servicios WHERE id = $4::int AND barberia_id = $2
  )
)
SELECT
  $5::boolean AS auth_ok_jwt,
  EXISTS (SELECT 1 FROM auth_check) AS auth_ok,
  EXISTS (SELECT 1 FROM barberia_check) AS barberia_ok,
  EXISTS (SELECT 1 FROM servicio_check) AS servicio_ok;
    `
  }
};

function updateNodeQuery(nodes, targetId, newQuery) {
  let updated = false;
  nodes.forEach(node => {
    if (node.id === targetId || (node.type === 'n8n-nodes-base.postgres' && node.name.toLowerCase().includes('session validate') && targetId === 'session-validate')) {
      if (node.parameters) {
        node.parameters.query = newQuery;
        updated = true;
      }
    } else if (node.id === targetId || (node.type === 'n8n-nodes-base.postgres' && node.name.toLowerCase().includes('login') && targetId === 'pg-login')) {
      if (node.parameters) {
        node.parameters.query = newQuery;
        updated = true;
      }
    } else if (node.id === targetId || (node.type === 'n8n-nodes-base.postgres' && node.name.toLowerCase().includes('update configuracion') && targetId === 'pg-update')) {
      if (node.parameters) {
        node.parameters.query = newQuery;
        updated = true;
      }
    } else if (node.id === targetId || (node.type === 'n8n-nodes-base.postgres' && node.name.toLowerCase().includes('session me') && targetId === 'db859604-6a11-4d0c-b32f-f409ce0256af')) {
      if (node.parameters) {
        node.parameters.query = newQuery;
        updated = true;
      }
    } else if (node.id === targetId) {
      if (node.parameters) {
        node.parameters.query = newQuery;
        updated = true;
      }
    }
  });
  return updated;
}

for (const [filename, info] of Object.entries(targetQueries)) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filename}`);
    continue;
  }
  
  const wf = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Update in root nodes
  let updated1 = false;
  if (wf.nodes) {
    updated1 = updateNodeQuery(wf.nodes, info.nodeId, info.query);
  }
  
  // Update in activeVersion nodes
  let updated2 = false;
  if (wf.activeVersion && wf.activeVersion.nodes) {
    updated2 = updateNodeQuery(wf.activeVersion.nodes, info.nodeId, info.query);
  }
  
  if (updated1 || updated2) {
    fs.writeFileSync(filePath, JSON.stringify(wf, null, 2), 'utf8');
    console.log(`Successfully updated ${filename} using AST mapping.`);
  } else {
    console.log(`Failed to update target node ${info.nodeId} in ${filename}`);
  }
}
