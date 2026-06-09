const fs = require('fs');
const path = require('path');

const replacements = {
  'login_workflow.json': [
    {
      target: `WHEN COALESCE(NULLIF(u.role, ''), 'admin') IN ('admin', 'owner', 'super_admin')\n                    AND (tb.owner_id = u.id OR lower(COALESCE(tb.email_contacto, '')) = lower(u.email))\n                    THEN 'allowed_admin'\n                  WHEN COALESCE(NULLIF(u.role, ''), 'admin') = 'barbero' AND bm.barbero_id IS NOT NULL\n                    THEN 'allowed_barbero'\n                  WHEN COALESCE(NULLIF(u.role, ''), 'admin') = 'cajero' AND (tb.owner_id = u.id OR bm.barbero_id IS NOT NULL)\n                    THEN 'allowed_cajero'`,
      replacement: `WHEN COALESCE(NULLIF(u.role, ''), 'admin') IN ('admin', 'owner', 'super_admin')\n                    AND (\n                      tb.owner_id = u.id OR \n                      EXISTS (\n                        SELECT 1 FROM public.barberia_miembros m \n                        WHERE m.barberia_id = tb.id \n                          AND (m.usuario_id = u.id OR lower(m.email) = lower(u.email)) \n                          AND m.rol IN ('owner', 'admin', 'super_admin')\n                          AND m.activo = true\n                      )\n                    )\n                    THEN 'allowed_admin'\n                  WHEN COALESCE(NULLIF(u.role, ''), 'admin') = 'barbero' AND (\n                    bm.barbero_id IS NOT NULL OR\n                    EXISTS (\n                      SELECT 1 FROM public.barberia_miembros m \n                      WHERE m.barberia_id = tb.id \n                        AND (m.usuario_id = u.id OR lower(m.email) = lower(u.email)) \n                        AND m.rol = 'barbero'\n                        AND m.activo = true\n                    )\n                  )\n                    THEN 'allowed_barbero'\n                  WHEN COALESCE(NULLIF(u.role, ''), 'admin') = 'cajero' AND (\n                    tb.owner_id = u.id OR \n                    bm.barbero_id IS NOT NULL OR\n                    EXISTS (\n                      SELECT 1 FROM public.barberia_miembros m \n                      WHERE m.barberia_id = tb.id \n                        AND (m.usuario_id = u.id OR lower(m.email) = lower(u.email)) \n                        AND m.rol IN ('owner', 'admin', 'cajero')\n                        AND m.activo = true\n                    )\n                  )\n                    THEN 'allowed_cajero'`
    }
  ],
  'session_me_workflow.json': [
    {
      target: `owned_barberias AS (\n  SELECT\n    b.id,\n    b.slug,\n    b.nombre,\n    'owner'::text AS role\n  FROM public.barberias b\n  JOIN resolved r ON b.owner_id = r.user_id\n  WHERE b.deleted_at IS NULL\n  ORDER BY b.id DESC\n),`,
      replacement: `owned_barberias AS (\n  SELECT DISTINCT ON (b.id)\n    b.id,\n    b.slug,\n    b.nombre,\n    x.role\n  FROM public.barberias b\n  JOIN resolved r ON true\n  JOIN LATERAL (\n    SELECT 'owner'::text AS role WHERE b.owner_id = r.user_id\n    UNION ALL\n    SELECT bm.rol::text AS role FROM public.barberia_miembros bm\n    WHERE bm.barberia_id = b.id \n      AND (bm.usuario_id = r.user_id OR lower(bm.email) = lower(r.email))\n      AND bm.activo = true\n  ) x ON true\n  WHERE b.deleted_at IS NULL\n  ORDER BY b.id DESC, CASE x.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'barbero' THEN 3 WHEN 'cajero' THEN 4 ELSE 5 END ASC\n),`
    }
  ],
  'dashboard_state_workflow.json': [
    {
      target: `barberia_check AS (\n  SELECT tb.id FROM target_barberia tb\n  LEFT JOIN auth_check ac ON true\n  WHERE (\n    tb.owner_id = $1 OR\n    lower(COALESCE(tb.email_contacto, '')) = lower(COALESCE(ac.email, '')) OR\n    EXISTS (SELECT 1 FROM public.barberos WHERE usuario_id = $1 AND barberia_id = tb.id)\n  )\n  AND ($2::int IS NULL OR $2::int = 0 OR tb.slug IS NULL OR $3::text IS NULL OR tb.slug = $3::text)\n  LIMIT 1\n)`,
      replacement: `barberia_check AS (\n  SELECT tb.id FROM target_barberia tb\n  LEFT JOIN auth_check ac ON true\n  WHERE (\n    tb.owner_id = $1 OR\n    EXISTS (\n      SELECT 1 FROM public.barberia_miembros m \n      WHERE m.barberia_id = tb.id \n        AND (m.usuario_id = $1 OR lower(m.email) = lower(ac.email)) \n        AND m.activo = true\n    ) OR\n    EXISTS (SELECT 1 FROM public.barberos WHERE usuario_id = $1 AND barberia_id = tb.id)\n  )\n  AND ($2::int IS NULL OR $2::int = 0 OR tb.slug IS NULL OR $3::text IS NULL OR tb.slug = $3::text)\n  LIMIT 1\n)`
    }
  ],
  'config_update_workflow.json': [
    {
      target: `      WHEN NOT (t.owner_id = i.user_id OR ac.role = 'super_admin') THEN 'sin_permiso'`,
      replacement: `      WHEN NOT (\n        t.owner_id = i.user_id \n        OR ac.role = 'super_admin' \n        OR EXISTS (\n          SELECT 1 FROM public.barberia_miembros m \n          WHERE m.barberia_id = t.id \n            AND (m.usuario_id = i.user_id OR lower(m.email) = lower(ac.email)) \n            AND m.rol IN ('owner', 'admin', 'super_admin')\n            AND m.activo = true\n        )\n      ) THEN 'sin_permiso'`
    }
  ],
  'barberos_workflow.json': [
    {
      target: `barberia_check AS (\n  SELECT b.id FROM public.barberias b\n  JOIN target_barberia tb ON b.id = tb.id\n  WHERE b.owner_id = $1 AND b.deleted_at IS NULL LIMIT 1\n),`,
      replacement: `barberia_check AS (\n  SELECT b.id FROM public.barberias b\n  JOIN target_barberia tb ON b.id = tb.id\n  WHERE (\n    b.owner_id = $1 \n    OR EXISTS (\n      SELECT 1 FROM public.barberia_miembros m \n      WHERE m.barberia_id = b.id \n        AND m.usuario_id = $1 \n        AND m.rol IN ('owner', 'admin')\n        AND m.activo = true\n    )\n  ) AND b.deleted_at IS NULL LIMIT 1\n),`
    }
  ],
  'citas_workflow.json': [
    {
      target: `barberia_check AS (\n  SELECT id FROM public.barberias WHERE id = $2 AND owner_id = $1 AND deleted_at IS NULL LIMIT 1\n),`,
      replacement: `barberia_check AS (\n  SELECT id FROM public.barberias \n  WHERE id = $2 AND (\n    owner_id = $1 \n    OR EXISTS (\n      SELECT 1 FROM public.barberia_miembros m \n      WHERE m.barberia_id = $2 \n        AND m.usuario_id = $1 \n        AND m.rol IN ('owner', 'admin')\n        AND m.activo = true\n    )\n  ) AND deleted_at IS NULL LIMIT 1\n),`
    }
  ],
  'servicios_workflow.json': [
    {
      target: `barberia_check AS (\n  SELECT id FROM public.barberias WHERE id = $2 AND owner_id = $1 AND deleted_at IS NULL LIMIT 1\n),`,
      replacement: `barberia_check AS (\n  SELECT id FROM public.barberias \n  WHERE id = $2 AND (\n    owner_id = $1 \n    OR EXISTS (\n      SELECT 1 FROM public.barberia_miembros m \n      WHERE m.barberia_id = $2 \n        AND m.usuario_id = $1 \n        AND m.rol IN ('owner', 'admin')\n        AND m.activo = true\n    )\n  ) AND deleted_at IS NULL LIMIT 1\n),`
    }
  ]
};

for (const [filename, list] of Object.entries(replacements)) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filename}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let replacedCount = 0;
  
  list.forEach(item => {
    // Normalise newlines to handle Windows/Unix discrepancies
    const targetNorm = item.target.replace(/\r\n/g, '\n');
    const contentNorm = content.replace(/\r\n/g, '\n');
    
    if (contentNorm.includes(targetNorm)) {
      content = contentNorm.replace(targetNorm, item.replacement);
      replacedCount++;
    } else {
      console.log(`Warning: Substring not found in ${filename}`);
      // Try string search with less strict whitespace in case of minor formatting differences
      const targetMin = targetNorm.replace(/\s+/g, ' ');
      const contentMin = contentNorm.replace(/\s+/g, ' ');
      if (contentMin.includes(targetMin)) {
        console.log(`-> Close match exists in ${filename} but exact spacing differs.`);
      }
    }
  });
  
  if (replacedCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Successfully updated ${replacedCount} queries in ${filename}`);
  } else {
    console.log(`No changes made to ${filename}`);
  }
}
