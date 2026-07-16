-- =============================================================================
-- MIGRACIÓN DE PRE-REQUISITO: AGREGAR CÓDIGOS DE PLANES
-- ARCHIVO: 20260713_2026_add_plan_codes.sql
-- ESTADO: SOLO LECTURA (NO EJECUTAR DIRECTAMENTE)
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- 1. Agregar columna temporal nullable para evitar bloqueos por reescritura
ALTER TABLE public.planes 
ADD COLUMN IF NOT EXISTS code TEXT;

-- 2. Backfill verificado de planes existentes usando el nombre estable
UPDATE public.planes 
SET code = 'starter' 
WHERE nombre = 'Starter';

UPDATE public.planes 
SET code = 'pro_legacy' 
WHERE nombre = 'Pro';

-- 3. Crear el nuevo plan canónico de BarberAgency si no existe
INSERT INTO public.planes (nombre, precio, code)
VALUES ('BarberAgency', 50000.00, 'barberagency_full')
ON CONFLICT (nombre) DO UPDATE 
SET code = 'barberagency_full', precio = 50000.00;

-- 4. Validar que no queden registros nulos (evita fallas antes del SET NOT NULL)
DO $body$
DECLARE
  v_null_count INT;
BEGIN
  SELECT COUNT(*) INTO v_null_count 
  FROM public.planes 
  WHERE code IS NULL;
  
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'Falla en el backfill de planes: existen % registros con código NULL.', v_null_count;
  END IF;
END $body$;

-- 5. Agregar CHECK constraint de formato para los códigos (alfanumérico y guión bajo)
ALTER TABLE public.planes 
ADD CONSTRAINT chk_planes_code CHECK (code ~ '^[a-z0-9_]+' AND length(code) = length(regexp_replace(code, '[^a-z0-9_]', '', 'g')));

-- 6. Agregar restricción UNIQUE física para evitar colisiones
ALTER TABLE public.planes 
ADD CONSTRAINT uq_planes_code UNIQUE (code);

-- 7. Establecer la columna como NOT NULL
ALTER TABLE public.planes 
ALTER COLUMN code SET NOT NULL;

-- 8. Mantener compatibilidad: Los registros de barberías y suscripciones que apuntaban a 'Pro'
-- (id = 2) siguen intactos apuntando a 'pro_legacy' (id = 2). No hay impacto destructivo.

COMMIT;
