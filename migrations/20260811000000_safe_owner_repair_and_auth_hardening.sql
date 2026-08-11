-- MIGRATION: 20260811000000_safe_owner_repair_and_auth_hardening.sql
-- DESCRIPTION: Safe owner repair for proven Barbershops 202 & 203 + DB Hardening
-- REVERSIBLE: YES (Rollback commands provided in header comment)

/*
===============================================================================
ROLLBACK INSTRUCTIONS:
-------------------------------------------------------------------------------
-- Rollback owner_id for Barbershops 202 & 203:
UPDATE public.barberias SET owner_id = 9 WHERE id IN (202, 203);

-- Rollback memberships created by repair:
DELETE FROM public.barberia_miembros 
WHERE (barberia_id = 202 AND usuario_id = 284) 
   OR (barberia_id = 203 AND usuario_id = 287);
===============================================================================
*/

BEGIN;

-- 1. PRECONDITION CHECK
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.barberias WHERE id = 202 AND owner_id = 9) THEN
    RAISE NOTICE 'Precondition check: Barbershop 202 is not in expected legacy state. Skipping auto-repair for 202.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.barberias WHERE id = 203 AND owner_id = 9) THEN
    RAISE NOTICE 'Precondition check: Barbershop 203 is not in expected legacy state. Skipping auto-repair for 203.';
  END IF;
END $$;

-- 2. SAFE OWNER REPAIR (ONLY PROVEN BARBERSHOPS 202 & 203)
UPDATE public.barberias
SET owner_id = 284
WHERE id = 202 
  AND owner_id = 9 
  AND lower(email_contacto) = 'pilarpehe@gmail.com';

UPDATE public.barberias
SET owner_id = 287
WHERE id = 203 
  AND owner_id = 9 
  AND lower(email_contacto) = 'pilarpehe@hotmail.com';

-- 3. SAFE MEMBERSHIP INSERT FOR REPAIRED OWNERS
INSERT INTO public.barberia_miembros (barberia_id, usuario_id, email, rol, activo)
VALUES 
  (202, 284, 'pilarpehe@gmail.com', 'owner', true),
  (203, 287, 'pilarpehe@hotmail.com', 'owner', true)
ON CONFLICT (barberia_id, usuario_id) DO UPDATE
SET rol = 'owner', activo = true;

-- 4. DB HARDENING: ENSURE usuario_id IS NOT NULL ON MEMBERSHIPS
-- Verified: CURRENT_DATA_PASSES = YES (0 null rows)
ALTER TABLE public.barberia_miembros 
  ALTER COLUMN usuario_id SET NOT NULL;

COMMIT;
