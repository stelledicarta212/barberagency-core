```sql
- ============================================================
-- SNAPSHOT SQL COMPLETO – SAAS BARBERÍA (PostgreSQL + PostgREST)
-- Incluye: modelo + triggers + anti-cruce + vistas + JWT + RLS
-- ============================================================
```

```sql
BEGIN;
```

```sql
- =========================
-- 0) EXTENSIONES
-- =========================
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

```sql
- =========================
-- 1) SAAS CORE
-- =========================
CREATE TABLE IF NOT EXISTS public.usuarios (
id SERIAL PRIMARY KEY,
nombre TEXT NOT NULL,
email TEXT NOT NULL UNIQUE,
created_at TIMESTAMPTZ DEFAULT now()
);
```

```sql
CREATE TABLE IF NOT EXISTS public.planes (
id SERIAL PRIMARY KEY,
nombre TEXT NOT NULL UNIQUE,
precio NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
created_at TIMESTAMPTZ DEFAULT now()
);
```

```sql
CREATE TABLE IF NOT EXISTS public.barberias (
id SERIAL PRIMARY KEY,
nombre TEXT NOT NULL,
slug TEXT UNIQUE NOT NULL,
estado TEXT NOT NULL DEFAULT 'activa',
created_at TIMESTAMPTZ DEFAULT now()
);
```

```sql
ALTER TABLE public.barberias
ADD COLUMN IF NOT EXISTS owner_id INT,
ADD COLUMN IF NOT EXISTS plan_id INT,
ADD COLUMN IF NOT EXISTS slot_min INT NOT NULL DEFAULT 15 CHECK (slot_min IN (5,10,15,20,30)),
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Bogota',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
```

```sql
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_barberias_owner') THEN
ALTER TABLE public.barberias
ADD CONSTRAINT fk_barberias_owner
FOREIGN KEY (owner_id) REFERENCES public.usuarios(id)
ON DELETE SET NULL;
END IF;
```

```sql
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_barberias_plan') THEN
ALTER TABLE public.barberias
ADD CONSTRAINT fk_barberias_plan
FOREIGN KEY (plan_id) REFERENCES public.planes(id)
ON DELETE SET NULL;
END IF;
END $$;
```

```sql
- (Opcional) impedir DELETE físico de barberías
CREATE OR REPLACE FUNCTION public.fn_prevent_barberia_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
RAISE EXCEPTION 'No se permite DELETE físico de barberias. Usa soft delete (deleted_at).';
END $$;
```

```sql
DROP TRIGGER IF EXISTS trg_prevent_barberia_delete ON public.barberias;
```

```sql
CREATE TRIGGER trg_prevent_barberia_delete
BEFORE DELETE ON public.barberias
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_barberia_delete();
```

```sql
- =========================
-- 2) TENANT DATA
-- =========================
CREATE TABLE IF NOT EXISTS public.horarios (
id SERIAL PRIMARY KEY,
barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
hora_abre TIME NOT NULL,
hora_cierra TIME NOT NULL,
activo BOOLEAN DEFAULT true,
CHECK (hora_cierra > hora_abre),
UNIQUE (barberia_id, dia_semana)
);
```

```sql
CREATE TABLE IF NOT EXISTS public.barberos (
id SERIAL PRIMARY KEY,
barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
nombre TEXT NOT NULL,
activo BOOLEAN DEFAULT true
);
```

```sql
CREATE TABLE IF NOT EXISTS public.servicios (
id SERIAL PRIMARY KEY,
barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
nombre TEXT NOT NULL,
duracion_min INT NOT NULL CHECK (duracion_min > 0),
precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0)
);
```

```sql
- =========================
-- 3) CLIENTES
-- =========================
CREATE TABLE IF NOT EXISTS public.clientes_finales (
id SERIAL PRIMARY KEY,
barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
nombre TEXT NOT NULL,
telefono TEXT NOT NULL,
created_at TIMESTAMPTZ DEFAULT now(),
deleted_at TIMESTAMPTZ,
UNIQUE (barberia_id, telefono)
);
```

```sql
CREATE INDEX IF NOT EXISTS ix_clientes_nombre_lower
ON public.clientes_finales (barberia_id, lower(nombre));
```

```sql
CREATE INDEX IF NOT EXISTS ix_clientes_nombre_trgm
ON public.clientes_finales USING gin (nombre gin_trgm_ops);
```

```sql
- =========================
-- 4) CITAS + TRIGGER + ANTI-CRUCE
-- =========================
CREATE TABLE IF NOT EXISTS public.citas (
id SERIAL PRIMARY KEY,
barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
barbero_id INT REFERENCES public.barberos(id),
servicio_id INT REFERENCES public.servicios(id),
cliente_id INT NULL,
fecha DATE NOT NULL,
hora_inicio TIME NOT NULL,
hora_fin TIME NOT NULL,
cliente_nombre TEXT NOT NULL,
cliente_tel TEXT NOT NULL,
estado TEXT DEFAULT 'confirmada',
created_at TIMESTAMPTZ DEFAULT now()
);
```

```sql
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_citas_cliente') THEN
ALTER TABLE public.citas
ADD CONSTRAINT fk_citas_cliente
FOREIGN KEY (cliente_id) REFERENCES public.clientes_finales(id)
ON DELETE SET NULL;
END IF;
END $$;
```

```sql
CREATE OR REPLACE FUNCTION public.fn_citas_set_y_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
v_duracion_min INT;
v_barbero_barberia INT;
v_servicio_barberia INT;
v_dia_semana INT;
v_abre TIME;
v_cierra TIME;
v_slot_min INT;
BEGIN
IF NEW.estado IS NULL THEN
NEW.estado := 'confirmada';
END IF;
```

```sql
IF NEW.estado NOT IN ('confirmada','pendiente','cancelada') THEN
RAISE EXCEPTION 'Estado inválido: %', NEW.estado;
END IF;
```

```sql
- barbería activa (soft delete)
IF EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = NEW.barberia_id AND br.deleted_at IS NOT NULL
) THEN
RAISE EXCEPTION 'Barbería % desactivada', NEW.barberia_id;
END IF;
```

```sql
- barbero pertenece al tenant
SELECT barberia_id INTO v_barbero_barberia
FROM public.barberos WHERE id = NEW.barbero_id;
```

```sql
IF v_barbero_barberia IS NULL THEN
RAISE EXCEPTION 'Barbero_id % no existe', NEW.barbero_id;
END IF;
```

```sql
IF v_barbero_barberia <> NEW.barberia_id THEN
RAISE EXCEPTION 'Barbero_id % no pertenece a barberia_id %', NEW.barbero_id, NEW.barberia_id;
END IF;
```

```sql
- servicio pertenece al tenant + duración
SELECT barberia_id, duracion_min INTO v_servicio_barberia, v_duracion_min
FROM public.servicios WHERE id = NEW.servicio_id;
```

```sql
IF v_servicio_barberia IS NULL THEN
RAISE EXCEPTION 'Servicio_id % no existe', NEW.servicio_id;
END IF;
```

```sql
IF v_servicio_barberia <> NEW.barberia_id THEN
RAISE EXCEPTION 'Servicio_id % no pertenece a barberia_id %', NEW.servicio_id, NEW.barberia_id;
END IF;
```

```sql
- malla slot_min
SELECT slot_min INTO v_slot_min
FROM public.barberias WHERE id = NEW.barberia_id;
```

```sql
IF v_slot_min IS NULL THEN v_slot_min := 15; END IF;
```

```sql
IF (EXTRACT(MINUTE FROM NEW.hora_inicio)::INT % v_slot_min) <> 0 THEN
RAISE EXCEPTION 'hora_inicio % no alineada a malla % min', NEW.hora_inicio, v_slot_min;
END IF;
```

```sql
- calcula hora_fin
NEW.hora_fin := (NEW.hora_inicio + make_interval(mins => v_duracion_min))::time;
```

```sql
- horario del día
v_dia_semana := EXTRACT(DOW FROM NEW.fecha)::INT;
```

```sql
SELECT hora_abre, hora_cierra INTO v_abre, v_cierra
FROM public.horarios
WHERE barberia_id = NEW.barberia_id
AND dia_semana = v_dia_semana
AND activo = true;
```

```sql
IF v_abre IS NULL OR v_cierra IS NULL THEN
RAISE EXCEPTION 'No hay horario activo para barbería % día %', NEW.barberia_id, v_dia_semana;
END IF;
```

```sql
IF NEW.hora_inicio < v_abre OR NEW.hora_fin > v_cierra THEN
RAISE EXCEPTION 'Cita fuera de horario (Abre % Cierra %) intento %-%',
v_abre, v_cierra, NEW.hora_inicio, NEW.hora_fin;
END IF;
```

```sql
RETURN NEW;
END;
$$;
```

```sql
DROP TRIGGER IF EXISTS trg_citas_set_y_validar ON public.citas;
```

```sql
CREATE TRIGGER trg_citas_set_y_validar
BEFORE INSERT OR UPDATE ON public.citas
FOR EACH ROW EXECUTE FUNCTION public.fn_citas_set_y_validar();
```

```sql
- Anti-cruce solo para confirmada/pendiente
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_citas_no_solape') THEN
ALTER TABLE public.citas
ADD CONSTRAINT ex_citas_no_solape
EXCLUDE USING gist (
barberia_id WITH =,
barbero_id WITH =,
tsrange((fecha + hora_inicio), (fecha + hora_fin), '[)') WITH &&
)
WHERE (estado IN ('confirmada','pendiente'));
END IF;
END $$;
```

```sql
- =========================
-- 5) PAGOS
-- =========================
DROP VIEW IF EXISTS public.v_citas_completas;
```

```sql
CREATE TABLE IF NOT EXISTS public.pagos (
id SERIAL PRIMARY KEY,
cita_id INT NOT NULL UNIQUE REFERENCES public.citas(id) ON DELETE CASCADE,
total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
metodo TEXT NOT NULL,
pagado_en TIMESTAMPTZ DEFAULT now()
);
```

```sql
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pagos_metodo') THEN
ALTER TABLE public.pagos
ADD CONSTRAINT chk_pagos_metodo
CHECK (metodo IN ('efectivo','digital'));
END IF;
END $$;
```

```sql
- =========================
-- 6) OPERACIÓN
-- =========================
CREATE TABLE IF NOT EXISTS public.productos (
id SERIAL PRIMARY KEY,
barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
nombre TEXT NOT NULL,
precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
activo BOOLEAN DEFAULT true,
created_at TIMESTAMPTZ DEFAULT now(),
UNIQUE (barberia_id, nombre)
);
```

```sql
CREATE TABLE IF NOT EXISTS public.gastos (
id SERIAL PRIMARY KEY,
barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
concepto TEXT NOT NULL,
total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
fecha DATE NOT NULL DEFAULT CURRENT_DATE,
created_at TIMESTAMPTZ DEFAULT now()
);
```

```sql
- =========================
-- 7) VISTAS
-- =========================
CREATE OR REPLACE VIEW public.v_citas_completas AS
SELECT
[c.id](http://c.id/) AS cita_id,
c.barberia_id,
c.fecha,
c.hora_inicio,
c.hora_fin,
c.estado,
b.nombre AS barbero,
s.nombre AS servicio,
s.precio AS precio_servicio,
c.cliente_nombre,
c.cliente_tel,
p.total AS pago_total,
p.metodo AS pago_metodo,
p.pagado_en AS pagado_en
FROM public.citas c
JOIN public.barberos b ON [b.id](http://b.id/) = c.barbero_id
JOIN public.servicios s ON [s.id](http://s.id/) = c.servicio_id
LEFT JOIN public.pagos p ON p.cita_id = [c.id](http://c.id/)
JOIN public.barberias br ON [br.id](http://br.id/) = c.barberia_id
WHERE br.deleted_at IS NULL;
```

```sql
CREATE OR REPLACE VIEW public.v_slots_disponibles AS
WITH base_slots AS (
SELECT
h.barberia_id,
[b.id](http://b.id/) AS barbero_id,
gs::date AS fecha,
(h.hora_abre + (n * make_interval(mins => br.slot_min)))::time AS hora_inicio,
(h.hora_abre + ((n + 1) * make_interval(mins => br.slot_min)))::time AS hora_fin
FROM public.horarios h
JOIN public.barberias br
ON [br.id](http://br.id/) = h.barberia_id
AND br.deleted_at IS NULL
JOIN public.barberos b
ON b.barberia_id = h.barberia_id
AND b.activo = true
JOIN generate_series(CURRENT_DATE, CURRENT_DATE + interval '30 days', interval '1 day') gs
ON EXTRACT(DOW FROM gs) = h.dia_semana
JOIN generate_series(
0,
GREATEST(
FLOOR(EXTRACT(EPOCH FROM (h.hora_cierra - h.hora_abre)) / (br.slot_min * 60))::int - 1,
0
)
) n ON true
WHERE h.activo = true
),
ocupados AS (
SELECT
barberia_id,
barbero_id,
fecha,
tsrange((fecha + hora_inicio), (fecha + hora_fin), '[)') AS rango
FROM public.citas
WHERE estado IN ('confirmada','pendiente')
)
SELECT
bs.barberia_id,
bs.barbero_id,
bs.fecha,
bs.hora_inicio,
bs.hora_fin
FROM base_slots bs
LEFT JOIN ocupados o
ON o.barberia_id = bs.barberia_id
AND o.barbero_id = bs.barbero_id
AND o.fecha = bs.fecha
AND tsrange((bs.fecha + bs.hora_inicio), (bs.fecha + bs.hora_fin), '[)') && o.rango
WHERE o.rango IS NULL
ORDER BY bs.barberia_id, bs.barbero_id, bs.fecha, bs.hora_inicio;
```

```sql
- =========================
-- 8) ROLES PARA POSTGREST
-- =========================
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
CREATE ROLE anon NOLOGIN;
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
CREATE ROLE authenticated NOLOGIN;
END IF;
END $$;
```

```sql
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
```

```sql
- (Mantener SELECT para que PostgREST “vea” el recurso; RLS filtra filas)
GRANT SELECT ON public.barberias, public.barberos, public.servicios, public.horarios,
public.clientes_finales, public.citas, public.pagos, public.productos, public.gastos
TO anon;
```

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

```sql
GRANT SELECT ON public.v_citas_completas TO authenticated;
GRANT SELECT ON public.v_slots_disponibles TO authenticated;
```

```sql
- =========================
-- 9) JWT HELPER PARA RLS
-- =========================
CREATE OR REPLACE FUNCTION public.jwt_user_id()
RETURNS int
LANGUAGE sql STABLE AS $$
SELECT
NULLIF(
(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'user_id'),
''
)::int
$$;
```

```sql
- =========================
-- 10) RLS POR OWNER (owner_id en barberias)
-- =========================
-- Recomendación: forzar RLS
ALTER TABLE public.barberias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_finales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
```

```sql
ALTER TABLE public.barberias       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.horarios        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.barberos        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.servicios       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_finales FORCE ROW LEVEL SECURITY;
ALTER TABLE public.citas           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pagos           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.productos       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gastos          FORCE ROW LEVEL SECURITY;
```

```sql
- Limpieza segura (para re-ejecutar sin chocar)
DROP POLICY IF EXISTS barberias_owner_all ON public.barberias;
DROP POLICY IF EXISTS horarios_owner_all ON public.horarios;
DROP POLICY IF EXISTS barberos_owner_all ON public.barberos;
DROP POLICY IF EXISTS servicios_owner_all ON public.servicios;
DROP POLICY IF EXISTS clientes_finales_owner_all ON public.clientes_finales;
DROP POLICY IF EXISTS citas_owner_all ON public.citas;
DROP POLICY IF EXISTS pagos_owner_all ON public.pagos;
DROP POLICY IF EXISTS productos_owner_all ON public.productos;
DROP POLICY IF EXISTS gastos_owner_all ON public.gastos;
```

```sql
- Barberías: solo el owner ve/edita
CREATE POLICY barberias_owner_all ON public.barberias
FOR ALL TO authenticated
USING (owner_id = public.jwt_user_id())
WITH CHECK (owner_id = public.jwt_user_id());
```

```sql
- Tablas con barberia_id: solo si la barbería pertenece al owner
CREATE POLICY horarios_owner_all ON public.horarios
FOR ALL TO authenticated
USING (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = horarios.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
)
WITH CHECK (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = horarios.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
);
```

```sql
CREATE POLICY barberos_owner_all ON public.barberos
FOR ALL TO authenticated
USING (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = barberos.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
)
WITH CHECK (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = barberos.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
);
```

```sql
CREATE POLICY servicios_owner_all ON public.servicios
FOR ALL TO authenticated
USING (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = servicios.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
)
WITH CHECK (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = servicios.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
);
```

```sql
CREATE POLICY clientes_finales_owner_all ON public.clientes_finales
FOR ALL TO authenticated
USING (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = clientes_finales.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
)
WITH CHECK (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = clientes_finales.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
);
```

```sql
CREATE POLICY citas_owner_all ON public.citas
FOR ALL TO authenticated
USING (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = citas.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
)
WITH CHECK (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = citas.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
);
```

```sql
CREATE POLICY productos_owner_all ON public.productos
FOR ALL TO authenticated
USING (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = productos.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
)
WITH CHECK (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = productos.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
);
```

```sql
CREATE POLICY gastos_owner_all ON public.gastos
FOR ALL TO authenticated
USING (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = gastos.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
)
WITH CHECK (
EXISTS (
SELECT 1 FROM public.barberias br
WHERE [br.id](http://br.id/) = gastos.barberia_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
);
```

```sql
- Pagos depende de cita -> barberia -> owner
CREATE POLICY pagos_owner_all ON public.pagos
FOR ALL TO authenticated
USING (
EXISTS (
SELECT 1
FROM public.citas c
JOIN public.barberias br ON [br.id](http://br.id/) = c.barberia_id
WHERE [c.id](http://c.id/) = pagos.cita_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
)
WITH CHECK (
EXISTS (
SELECT 1
FROM public.citas c
JOIN public.barberias br ON [br.id](http://br.id/) = c.barberia_id
WHERE [c.id](http://c.id/) = pagos.cita_id
AND br.owner_id = public.jwt_user_id()
AND br.deleted_at IS NULL
)
);
```

```sql
COMMIT;
```

VARIABLES EN ENTRONO DE EASYPANEL EN API 

```sql
PGRST_DB_URI=...
PGRST_DB_SCHEMA=public
PGRST_DB_ANON_ROLE=anon
PGRST_SERVER_PORT=3000
PGRST_JWT_SECRET=mi_super_secret_jwt_barberia_2026
```

```sql
BEGIN;
`CREATE TABLE IF NOT EXISTS public.auth_otps (
id SERIAL PRIMARY KEY,
email TEXT NOT NULL,
code_hash TEXT NOT NULL,
expires_at TIMESTAMPTZ NOT NULL,
used_at TIMESTAMPTZ,
created_at TIMESTAMPTZ DEFAULT now(),
attempts INT NOT NULL DEFAULT 0
);`

`CREATE INDEX IF NOT EXISTS ix_auth_otps_email ON public.auth_otps (email);
CREATE INDEX IF NOT EXISTS ix_auth_otps_expires ON public.auth_otps (expires_at);`

`COMMIT;`
```

EXTENSIÓN TABLA USUARIOS

```sql
1) EXTENSIÓN TABLA USUARIOS
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS apellido TEXT,
  ADD COLUMN IF NOT EXISTS picture_url TEXT;
🔹 2) FUNCIÓN GLOBAL updated_at
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
🔹 3) TABLA SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id BIGSERIAL PRIMARY KEY,
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  plan_id INT REFERENCES public.planes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_end TIMESTAMPTZ,
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_subscriptions_status') THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT chk_subscriptions_status
      CHECK (status IN ('trialing','active','past_due','canceled','paused','incomplete'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_subscriptions_period') THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT chk_subscriptions_period
      CHECK (period_end IS NULL OR period_end > period_start);
  END IF;
END $$;
Índices
CREATE INDEX IF NOT EXISTS ix_subscriptions_barberia_id ON public.subscriptions (barberia_id);
CREATE INDEX IF NOT EXISTS ix_subscriptions_status ON public.subscriptions (status);
CREATE INDEX IF NOT EXISTS ix_subscriptions_period_end ON public.subscriptions (period_end DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS ix_subscriptions_provider_ref ON public.subscriptions (provider, provider_ref);
Trigger updated_at
DROP TRIGGER IF EXISTS trg_subscriptions_set_updated_at ON public.subscriptions;

CREATE TRIGGER trg_subscriptions_set_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
🔹 4) VISTA SUSCRIPCIÓN ACTUAL
CREATE OR REPLACE VIEW public.v_subscription_current AS
SELECT DISTINCT ON (s.barberia_id)
  s.barberia_id,
  s.id AS subscription_id,
  s.plan_id,
  s.status,
  s.period_start,
  s.period_end,
  s.provider,
  s.provider_ref,
  s.created_at,
  s.updated_at
FROM public.subscriptions s
ORDER BY s.barberia_id, s.period_start DESC, s.created_at DESC;
🔹 5) EXTENSIÓN TABLA BARBERIAS (ONBOARDING)
ALTER TABLE public.barberias
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS email_contacto TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS ciudad TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS tiktok TEXT,
  ADD COLUMN IF NOT EXISTS politicas TEXT,
  ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS acepta_efectivo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS acepta_digital BOOLEAN NOT NULL DEFAULT true;
🔹 6) TABLA barberia_assets
CREATE TABLE IF NOT EXISTS public.barberia_assets (
  id BIGSERIAL PRIMARY KEY,
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  url TEXT NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_barberia_assets_tipo') THEN
    ALTER TABLE public.barberia_assets
      ADD CONSTRAINT chk_barberia_assets_tipo
      CHECK (tipo IN ('logo','cover','gallery','qr','other'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS ix_barberia_assets_barberia_id ON public.barberia_assets (barberia_id);
CREATE INDEX IF NOT EXISTS ix_barberia_assets_tipo ON public.barberia_assets (barberia_id, tipo, orden);
DROP TRIGGER IF EXISTS trg_barberia_assets_set_updated_at ON public.barberia_assets;

CREATE TRIGGER trg_barberia_assets_set_updated_at
BEFORE UPDATE ON public.barberia_assets
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
🔹 7) TABLA barberia_theme
CREATE TABLE IF NOT EXISTS public.barberia_theme (
  barberia_id INT PRIMARY KEY REFERENCES public.barberias(id) ON DELETE CASCADE,
  primary_color TEXT NOT NULL DEFAULT '#111827',
  secondary_color TEXT NOT NULL DEFAULT '#F59E0B',
  background_color TEXT NOT NULL DEFAULT '#FFFFFF',
  text_color TEXT NOT NULL DEFAULT '#111827',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_barberia_theme_set_updated_at ON public.barberia_theme;

CREATE TRIGGER trg_barberia_theme_set_updated_at
BEFORE UPDATE ON public.barberia_theme
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
🔹 8) TABLA barberia_public_profiles
CREATE TABLE IF NOT EXISTS public.barberia_public_profiles (
  barberia_id INT PRIMARY KEY REFERENCES public.barberias(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  qr_enabled BOOLEAN NOT NULL DEFAULT true,
  nombre_publico TEXT NOT NULL,
  logo_url TEXT,
  cover_url TEXT,
  ciudad TEXT,
  direccion TEXT,
  telefono TEXT,
  whatsapp TEXT,
  email_contacto TEXT,
  instagram TEXT,
  tiktok TEXT,
  politicas TEXT,
  moneda TEXT NOT NULL DEFAULT 'COP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_barberia_public_profiles_enabled ON public.barberia_public_profiles (enabled);
CREATE INDEX IF NOT EXISTS ix_barberia_public_profiles_slug ON public.barberia_public_profiles (slug);
DROP TRIGGER IF EXISTS trg_barberia_public_profiles_set_updated_at ON public.barberia_public_profiles;

CREATE TRIGGER trg_barberia_public_profiles_set_updated_at
BEFORE UPDATE ON public.barberia_public_profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
🔹 9) VISTA PÚBLICA LANDING
CREATE OR REPLACE VIEW public.v_barberia_public_landing AS
SELECT
  p.slug,
  p.nombre_publico,
  p.logo_url,
  p.cover_url,
  p.ciudad,
  p.direccion,
  p.telefono,
  p.whatsapp,
  p.email_contacto,
  p.instagram,
  p.tiktok,
  p.politicas,
  p.moneda,
  t.primary_color,
  t.secondary_color,
  t.background_color,
  t.text_color
FROM public.barberia_public_profiles p
LEFT JOIN public.barberia_theme t ON t.barberia_id = p.barberia_id
WHERE p.enabled = true;
🔹 10) RLS NUEVAS TABLAS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.barberia_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberia_assets FORCE ROW LEVEL SECURITY;

ALTER TABLE public.barberia_theme ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberia_theme FORCE ROW LEVEL SECURITY;

ALTER TABLE public.barberia_public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberia_public_profiles FORCE ROW LEVEL SECURITY;
🔹 11) POLICIES OWNER
CREATE POLICY subscriptions_owner_all ON public.subscriptions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barberias br
    WHERE br.id = subscriptions.barberia_id
      AND br.owner_id = public.jwt_user_id()
      AND br.deleted_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.barberias br
    WHERE br.id = subscriptions.barberia_id
      AND br.owner_id = public.jwt_user_id()
      AND br.deleted_at IS NULL
  )
);

(Repetir mismo patrón para barberia_assets, barberia_theme y barberia_public_profiles)

🔹 12) POLICIES ANON (SOLO PÚBLICO)
CREATE POLICY barberia_public_profiles_anon_select_enabled ON public.barberia_public_profiles
FOR SELECT TO anon
USING (
  enabled = true
  AND EXISTS (
    SELECT 1 FROM public.barberias br
    WHERE br.id = barberia_public_profiles.barberia_id
      AND br.deleted_at IS NULL
  )
);
CREATE POLICY barberia_theme_anon_select_public ON public.barberia_theme
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.barberia_public_profiles p
    JOIN public.barberias br ON br.id = p.barberia_id
    WHERE p.barberia_id = barberia_theme.barberia_id
      AND p.enabled = true
      AND br.deleted_at IS NULL
  )
);
🔹 13) GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.subscriptions_id_seq TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.barberia_assets TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.barberia_assets_id_seq TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.barberia_theme TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barberia_public_profiles TO authenticated;

GRANT SELECT ON public.barberia_public_profiles TO anon;
GRANT SELECT ON public.barberia_theme TO anon;
GRANT SELECT ON public.v_barberia_public_landing TO anon;

GRANT SELECT ON public.v_subscription_current TO authenticated;
```

```sql
- ============================================================
-- PARTE 1/6 — EXTENSIÓN (pgcrypto)
-- Pega y ejecuta tal cual
-- ============================================================
BEGIN;
```

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

```sql
COMMIT;
```

```sql
- ============================================================- PARTE 2/6 — USUARIOS: role + password_hash + constraint + index- Pega y ejecuta tal cual- ============================================================BEGIN;ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin', ADD COLUMN IF NOT EXISTS password_hash TEXT;DO $$BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_usuarios_role') THEN ALTER TABLE public.usuarios ADD CONSTRAINT chk_usuarios_role CHECK (role IN ('admin','barbero')); END IF;END $$;CREATE INDEX IF NOT EXISTS ix_usuarios_role ON public.usuarios (role);UPDATE public.usuariosSET role = 'admin'WHERE role IS NULL;COMMIT;
```

```sql
-- ============================================================
-- PARTE 3/6 — BARBEROS: agregar usuario_id + FK + índices
-- Pega y ejecuta tal cual
-- ============================================================
BEGIN;

ALTERTABLE public.barberos
ADDCOLUMNIFNOTEXISTS usuario_idINT;

DO $$
BEGIN
IFNOTEXISTS (SELECT1FROM pg_constraintWHERE conname='fk_barberos_usuario')THEN
ALTERTABLE public.barberos
ADDCONSTRAINT fk_barberos_usuario
FOREIGNKEY (usuario_id)REFERENCES public.usuarios(id)
ONDELETESETNULL;
ENDIF;
END $$;

CREATEUNIQUE INDEXIFNOTEXISTS ux_barberos_usuario_id_notnull
ON public.barberos (usuario_id)
WHERE usuario_idISNOTNULL;

CREATE INDEXIFNOTEXISTS ix_barberos_usuario_id
ON public.barberos (usuario_id);

COMMIT;
```

```sql
-- ============================================================
-- PARTE 4/6 — JWT HELPERS: role claim + is_admin + is_barbero
-- Pega y ejecuta tal cual
-- ============================================================
BEGIN;

CREATEOR REPLACEFUNCTION public.jwt_role()
RETURNS text
LANGUAGEsql STABLEAS $$
SELECT NULLIF(
  (NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role'),
''
)
$$;

CREATEOR REPLACEFUNCTION public.jwt_is_admin()
RETURNSboolean
LANGUAGEsql STABLEAS $$
SELECT COALESCE(public.jwt_role()='admin',false)
$$;

CREATEOR REPLACEFUNCTION public.jwt_is_barbero()
RETURNSboolean
LANGUAGEsql STABLEAS $$
SELECT COALESCE(public.jwt_role()='barbero',false)
$$;

COMMIT;
```

```sql
-- ============================================================
-- PARTE 5/6 — PASSWORD HELPERS + RPC LOGIN (NO toca tu auth actual)
-- Pega y ejecuta tal cual
-- ============================================================
BEGIN;

CREATEOR REPLACEFUNCTION public.fn_password_hash(p_plain text)
RETURNS text
LANGUAGEsql IMMUTABLEAS $$
SELECT crypt(p_plain, gen_salt('bf'))
$$;

CREATEOR REPLACEFUNCTION public.fn_password_verify(p_plain text, p_hash text)
RETURNSboolean
LANGUAGEsql IMMUTABLEAS $$
SELECT (p_hashISNOTNULL)AND (crypt(p_plain, p_hash)= p_hash)
$$;

CREATEOR REPLACEFUNCTION public.auth_login_password(p_email text, p_password text)
RETURNSTABLE(user_idint,role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
RETURN QUERY
SELECT u.id, u.role
FROM public.usuarios u
WHERE lower(u.email)= lower(p_email)
AND public.fn_password_verify(p_password, u.password_hash)=true
LIMIT1;
END;
$$;

REVOKEALLONFUNCTION public.auth_login_password(text, text)FROMPUBLIC;
GRANTEXECUTEONFUNCTION public.auth_login_password(text, text)TO anon, authenticated;

COMMIT;
```

```sql
-- ============================================================
-- PARTE 6/6 — RLS: Policies para BARBERO (solo SELECT asignado)
-- (Admin ya está cubierto por policies owner existentes)
-- Pega y ejecuta tal cual
-- ============================================================
BEGIN;

-- CITAS: barbero solo SELECT de sus citas
DROP POLICYIFEXISTS citas_barbero_selectON public.citas;

CREATE POLICY citas_barbero_selectON public.citas
FORSELECTTO authenticated
USING (
  public.jwt_is_barbero()
ANDEXISTS (
SELECT1
FROM public.barberos b
JOIN public.barberias brON br.id= b.barberia_id
WHERE b.id= citas.barbero_id
AND b.usuario_id= public.jwt_user_id()
AND br.deleted_atISNULL
  )
);

-- BARBEROS: barbero ve solo su registro
DROP POLICYIFEXISTS barberos_barbero_select_selfON public.barberos;

CREATE POLICY barberos_barbero_select_selfON public.barberos
FORSELECTTO authenticated
USING (
  public.jwt_is_barbero()
AND barberos.usuario_id= public.jwt_user_id()
ANDEXISTS (
SELECT1FROM public.barberias br
WHERE br.id= barberos.barberia_id
AND br.deleted_atISNULL
  )
);

-- SERVICIOS: barbero ve servicios de su barbería
DROP POLICYIFEXISTS servicios_barbero_select_tenantON public.servicios;

CREATE POLICY servicios_barbero_select_tenantON public.servicios
FORSELECTTO authenticated
USING (
  public.jwt_is_barbero()
ANDEXISTS (
SELECT1
FROM public.barberos b
JOIN public.barberias brON br.id= b.barberia_id
WHERE b.usuario_id= public.jwt_user_id()
AND b.barberia_id= servicios.barberia_id
AND br.deleted_atISNULL
  )
);

-- BARBERIAS: barbero ve su barbería (solo SELECT)
DROP POLICYIFEXISTS barberias_barbero_select_tenantON public.barberias;

CREATE POLICY barberias_barbero_select_tenantON public.barberias
FORSELECTTO authenticated
USING (
  public.jwt_is_barbero()
ANDEXISTS (
SELECT1FROM public.barberos b
WHERE b.usuario_id= public.jwt_user_id()
AND b.barberia_id= barberias.id
  )
AND barberias.deleted_atISNULL
);

-- GRANTS mínimos (sin romper lo existente)
GRANTSELECTON public.barberias, public.barberos, public.servicios, public.citasTO authenticated;

COMMIT;
```

```sql
-- ============================================================
-- (OPCIONAL) VERIFICACIÓN RÁPIDA — Pega y ejecuta al final
-- ============================================================

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema='public'
AND (
    (table_name='usuarios'AND column_nameIN ('role','password_hash'))
OR (table_name='barberos'AND column_name='usuario_id')
  )
ORDERBY table_name, column_name;

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname='public'
AND policynameIN (
'citas_barbero_select',
'barberos_barbero_select_self',
'servicios_barbero_select_tenant',
'barberias_barbero_select_tenant'
  )
ORDERBY tablename, policyname;
```

PRUEBAS 

de lo ultimo 

Ahora necesitas probar que el modelo realmente funciona.

### 1️⃣ Crear un usuario barbero real

Ejemplo:

```sql
UPDATE public.usuarios
SET
role='barbero',
  password_hash= public.fn_password_hash('123456')
WHERE email='barbero@test.com';
```

Luego vincularlo:

```sql
UPDATE public.barberos
SET usuario_id= (
SELECT idFROM public.usuariosWHERE email='barbero@test.com'
)
WHERE id=1;-- el id del barbero correspondiente
```

---

### 2️⃣ Simular claims en pgAdmin (prueba RLS)

```sql
SELECT set_config(
'request.jwt.claims',
'{"user_id":"2","role":"barbero"}',
true
);

SELECT*FROM public.citas;
```

Debe devolver solo las citas asignadas a ese barbero.

# PATCH SQL — EXTENSIONES AGREGADAS AL SNAPSHOT

```
-- ============================================================
-- PATCH BARBERAGENCY
-- EXTENSIONES AGREGADAS DESPUÉS DEL SNAPSHOT ORIGINAL
-- ============================================================

BEGIN;
```

---

# 1️⃣ TABLA `auth_otps` (login por código)

```sql
CREATETABLEIFNOTEXISTS public.auth_otps (
id SERIALPRIMARYKEY,
email TEXTNOTNULL,
code_hash TEXTNOTNULL,
expires_at TIMESTAMPTZNOTNULL,
used_at TIMESTAMPTZ,
created_at TIMESTAMPTZDEFAULT now(),
attemptsINTNOTNULLDEFAULT0
);

CREATE INDEXIFNOTEXISTS ix_auth_otps_email
ON public.auth_otps (email);

CREATE INDEXIFNOTEXISTS ix_auth_otps_expires
ON public.auth_otps (expires_at);
```

---

# 2️⃣ EXTENSIÓN TABLA `usuarios`

```sql
ALTERTABLE public.usuarios
ADDCOLUMNIFNOTEXISTS apellido TEXT,
ADDCOLUMNIFNOTEXISTS picture_url TEXT;
```

---

# 3️⃣ FUNCIÓN GLOBAL `updated_at`

```sql
CREATEOR REPLACEFUNCTION public.fn_set_updated_at()
RETURNStrigger
LANGUAGE plpgsql
AS $$
BEGIN
NEW.updated_at := now();
RETURNNEW;
END;
$$;
```

---

# 4️⃣ TABLA `subscriptions` (suscripciones SaaS)

```sql
CREATETABLEIFNOTEXISTS public.subscriptions (
id BIGSERIALPRIMARYKEY,
barberia_idINTNOTNULLREFERENCES public.barberias(id)ONDELETECASCADE,
plan_idINTREFERENCES public.planes(id)ONDELETESETNULL,
status TEXTNOTNULLDEFAULT'active',
period_start TIMESTAMPTZNOTNULLDEFAULT now(),
period_end TIMESTAMPTZ,
provider TEXTNOTNULLDEFAULT'manual',
provider_ref TEXT,
created_at TIMESTAMPTZNOTNULLDEFAULT now(),
updated_at TIMESTAMPTZNOTNULLDEFAULT now()
);
```

### constraints

```sql
DO $$
BEGIN

IFNOTEXISTS (
SELECT1FROM pg_constraint
WHERE conname='chk_subscriptions_status'
)THEN

ALTERTABLE public.subscriptions
ADDCONSTRAINT chk_subscriptions_status
CHECK (
statusIN (
'trialing',
'active',
'past_due',
'canceled',
'paused',
'incomplete'
)
);

ENDIF;

IFNOTEXISTS (
SELECT1FROM pg_constraint
WHERE conname='chk_subscriptions_period'
)THEN

ALTERTABLE public.subscriptions
ADDCONSTRAINT chk_subscriptions_period
CHECK (
period_endISNULLOR period_end> period_start
);

ENDIF;

END $$;
```

### índices

```sql
CREATE INDEXIFNOTEXISTS ix_subscriptions_barberia_id
ON public.subscriptions (barberia_id);

CREATE INDEXIFNOTEXISTS ix_subscriptions_status
ON public.subscriptions (status);

CREATE INDEXIFNOTEXISTS ix_subscriptions_period_end
ON public.subscriptions (period_endDESC NULLSLAST);

CREATE INDEXIFNOTEXISTS ix_subscriptions_provider_ref
ON public.subscriptions (provider, provider_ref);
```

### trigger updated_at

```sql
DROPTRIGGERIFEXISTS trg_subscriptions_set_updated_at
ON public.subscriptions;

CREATETRIGGER trg_subscriptions_set_updated_at
BEFOREUPDATEON public.subscriptions
FOREACHROW
EXECUTEFUNCTION public.fn_set_updated_at();
```

---

# 5️⃣ VISTA `v_subscription_current`

```sql
CREATEOR REPLACEVIEW public.v_subscription_currentAS
SELECTDISTINCTON (s.barberia_id)

s.barberia_id,
s.idAS subscription_id,
s.plan_id,
s.status,
s.period_start,
s.period_end,
s.provider,
s.provider_ref,
s.created_at,
s.updated_at

FROM public.subscriptions s

ORDERBY
s.barberia_id,
s.period_startDESC,
s.created_atDESC;
```

---

# 6️⃣ EXTENSIÓN TABLA `barberias` (onboarding)

```sql
ALTERTABLE public.barberias
ADDCOLUMNIFNOTEXISTS logo_url TEXT,
ADDCOLUMNIFNOTEXISTS cover_url TEXT,
ADDCOLUMNIFNOTEXISTS telefono TEXT,
ADDCOLUMNIFNOTEXISTS whatsapp TEXT,
ADDCOLUMNIFNOTEXISTS email_contacto TEXT,
ADDCOLUMNIFNOTEXISTS direccion TEXT,
ADDCOLUMNIFNOTEXISTS ciudad TEXT,
ADDCOLUMNIFNOTEXISTS instagram TEXT,
ADDCOLUMNIFNOTEXISTS tiktok TEXT,
ADDCOLUMNIFNOTEXISTS politicas TEXT,
ADDCOLUMNIFNOTEXISTS moneda TEXTNOTNULLDEFAULT'COP',
ADDCOLUMNIFNOTEXISTS acepta_efectivoBOOLEANNOTNULLDEFAULTtrue,
ADDCOLUMNIFNOTEXISTS acepta_digitalBOOLEANNOTNULLDEFAULTtrue;
```

---

# 7️⃣ TABLA `barberia_assets`

```sql
CREATETABLEIFNOTEXISTS public.barberia_assets (

id BIGSERIALPRIMARYKEY,

barberia_idINTNOTNULL
REFERENCES public.barberias(id)
ONDELETECASCADE,

tipo TEXTNOTNULL,

url TEXTNOTNULL,

ordenINTNOTNULLDEFAULT0,

activoBOOLEANNOTNULLDEFAULTtrue,

created_at TIMESTAMPTZNOTNULLDEFAULT now(),

updated_at TIMESTAMPTZNOTNULLDEFAULT now()

);
```

### constraint tipo

```sql
DO $$
BEGIN

IFNOTEXISTS (
SELECT1FROM pg_constraint
WHERE conname='chk_barberia_assets_tipo'
)THEN

ALTERTABLE public.barberia_assets
ADDCONSTRAINT chk_barberia_assets_tipo
CHECK (
tipoIN ('logo','cover','gallery','qr','other')
);

ENDIF;

END $$;
```

### índices

```sql
CREATE INDEXIFNOTEXISTS ix_barberia_assets_barberia_id
ON public.barberia_assets (barberia_id);

CREATE INDEXIFNOTEXISTS ix_barberia_assets_tipo
ON public.barberia_assets (barberia_id, tipo, orden);
```

### trigger

```sql
DROPTRIGGERIFEXISTS trg_barberia_assets_set_updated_at
ON public.barberia_assets;

CREATETRIGGER trg_barberia_assets_set_updated_at
BEFOREUPDATEON public.barberia_assets
FOREACHROW
EXECUTEFUNCTION public.fn_set_updated_at();
```

---

# 8️⃣ TABLA `barberia_theme`

```sql
CREATETABLEIFNOTEXISTS public.barberia_theme (

barberia_idINTPRIMARYKEY
REFERENCES public.barberias(id)
ONDELETECASCADE,

primary_color TEXTNOTNULLDEFAULT'#111827',

secondary_color TEXTNOTNULLDEFAULT'#F59E0B',

background_color TEXTNOTNULLDEFAULT'#FFFFFF',

text_color TEXTNOTNULLDEFAULT'#111827',

updated_at TIMESTAMPTZNOTNULLDEFAULT now()

);
```

trigger:

```sql
DROPTRIGGERIFEXISTS trg_barberia_theme_set_updated_at
ON public.barberia_theme;

CREATETRIGGER trg_barberia_theme_set_updated_at
BEFOREUPDATEON public.barberia_theme
FOREACHROW
EXECUTEFUNCTION public.fn_set_updated_at();
```

---

# 9️⃣ TABLA `barberia_public_profiles`

```sql
CREATETABLEIFNOTEXISTS public.barberia_public_profiles (

barberia_idINTPRIMARYKEY
REFERENCES public.barberias(id)
ONDELETECASCADE,

slug TEXTNOTNULLUNIQUE,

enabledBOOLEANNOTNULLDEFAULTfalse,

qr_enabledBOOLEANNOTNULLDEFAULTtrue,

nombre_publico TEXTNOTNULL,

logo_url TEXT,
cover_url TEXT,

ciudad TEXT,
direccion TEXT,

telefono TEXT,
whatsapp TEXT,

email_contacto TEXT,

instagram TEXT,
tiktok TEXT,

politicas TEXT,

moneda TEXTNOTNULLDEFAULT'COP',

created_at TIMESTAMPTZNOTNULLDEFAULT now(),

updated_at TIMESTAMPTZNOTNULLDEFAULT now()

);
```

índices

```sql
CREATE INDEXIFNOTEXISTS ix_barberia_public_profiles_enabled
ON public.barberia_public_profiles (enabled);

CREATE INDEXIFNOTEXISTS ix_barberia_public_profiles_slug
ON public.barberia_public_profiles (slug);
```

trigger

```sql
DROPTRIGGERIFEXISTS trg_barberia_public_profiles_set_updated_at
ON public.barberia_public_profiles;

CREATETRIGGER trg_barberia_public_profiles_set_updated_at
BEFOREUPDATEON public.barberia_public_profiles
FOREACHROW
EXECUTEFUNCTION public.fn_set_updated_at();
```

---

# 10️⃣ VISTA `v_barberia_public_landing`

```sql
CREATEOR REPLACEVIEW public.v_barberia_public_landingAS

SELECT

p.slug,
p.nombre_publico,
p.logo_url,
p.cover_url,
p.ciudad,
p.direccion,
p.telefono,
p.whatsapp,
p.email_contacto,
p.instagram,
p.tiktok,
p.politicas,
p.moneda,

t.primary_color,
t.secondary_color,
t.background_color,
t.text_color

FROM public.barberia_public_profiles p

LEFTJOIN public.barberia_theme t
ON t.barberia_id= p.barberia_id

WHERE p.enabled=true;
```

---

# 11️⃣ RLS NUEVAS TABLAS

```sql
ALTERTABLE public.subscriptions ENABLEROWLEVEL SECURITY;
ALTERTABLE public.subscriptions FORCEROWLEVEL SECURITY;

ALTERTABLE public.barberia_assets ENABLEROWLEVEL SECURITY;
ALTERTABLE public.barberia_assets FORCEROWLEVEL SECURITY;

ALTERTABLE public.barberia_theme ENABLEROWLEVEL SECURITY;
ALTERTABLE public.barberia_theme FORCEROWLEVEL SECURITY;

ALTERTABLE public.barberia_public_profiles ENABLEROWLEVEL SECURITY;
ALTERTABLE public.barberia_public_profiles FORCEROWLEVEL SECURITY;
```

---

# 12️⃣ POLICY OWNER (suscripciones)

```sql
CREATE POLICY subscriptions_owner_all
ON public.subscriptions
FORALLTO authenticated

USING (

EXISTS (
SELECT1
FROM public.barberias br
WHERE br.id= subscriptions.barberia_id
AND br.owner_id= public.jwt_user_id()
AND br.deleted_atISNULL
)

)

WITHCHECK (

EXISTS (
SELECT1
FROM public.barberias br
WHERE br.id= subscriptions.barberia_id
AND br.owner_id= public.jwt_user_id()
AND br.deleted_atISNULL
)

);
```

---

# 13️⃣ POLICIES ANON (landing pública)

```sql
CREATE POLICY barberia_public_profiles_anon_select_enabled
ON public.barberia_public_profiles
FORSELECTTO anon

USING (

enabled=true

ANDEXISTS (
SELECT1
FROM public.barberias br
WHERE br.id= barberia_public_profiles.barberia_id
AND br.deleted_atISNULL
)

);
```

---

# 14️⃣ GRANTS

```sql
GRANTSELECT,INSERT,UPDATE,DELETE
ON public.subscriptions
TO authenticated;

GRANTSELECT,INSERT,UPDATE,DELETE
ON public.barberia_assets
TO authenticated;

GRANTSELECT,INSERT,UPDATE,DELETE
ON public.barberia_theme
TO authenticated;

GRANTSELECT,INSERT,UPDATE,DELETE
ON public.barberia_public_profiles
TO authenticated;

GRANTSELECT
ON public.barberia_public_profiles
TO anon;

GRANTSELECT
ON public.barberia_theme
TO anon;

GRANTSELECT
ON public.v_barberia_public_landing
TO anon;

GRANTSELECT
ON public.v_subscription_current
TO authenticated;
```