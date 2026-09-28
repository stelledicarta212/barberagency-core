-- =============================================================================
-- BARBERAGENCY CORE SCHEMA CANONICALIZATION: LOYALTY MODULE (PHASE 1)
-- Migration: 20260928_1500_loyalty_core_phase1.sql
-- Description: Core persistence, immutable ledger, rewards catalog, redemptions,
--              derived balance view, anti-cross-tenant triggers, append-only trigger,
--              and multi-tenant RLS policies.
-- Constraints: Zero modifications to public.pagos, public.citas, public.clientes_finales.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. PREREQUISITES VERIFICATION
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.barberias') IS NULL THEN
    RAISE EXCEPTION 'LOYALTY_PHASE1_PREREQUISITE_MISSING: public.barberias';
  END IF;
  IF to_regclass('public.clientes_finales') IS NULL THEN
    RAISE EXCEPTION 'LOYALTY_PHASE1_PREREQUISITE_MISSING: public.clientes_finales';
  END IF;
  IF to_regclass('public.usuarios') IS NULL THEN
    RAISE EXCEPTION 'LOYALTY_PHASE1_PREREQUISITE_MISSING: public.usuarios';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'jwt_user_id'
  ) THEN
    RAISE EXCEPTION 'LOYALTY_PHASE1_PREREQUISITE_MISSING: public.jwt_user_id()';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. TABLE: public.barberia_loyalty_config (1:1 per barberia)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.barberia_loyalty_config (
  barberia_id INT PRIMARY KEY REFERENCES public.barberias(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  program_type VARCHAR(50) NOT NULL DEFAULT 'stamps' CHECK (program_type IN ('stamps')),
  sellos_requeridos INT NOT NULL DEFAULT 10 CHECK (sellos_requeridos > 0),
  recompensa_default VARCHAR(255) NOT NULL DEFAULT 'Corte Gratis',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. TABLE: public.loyalty_rewards (Reward Catalog per tenant)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id SERIAL PRIMARY KEY,
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  costo_en_sellos INT NOT NULL CHECK (costo_en_sellos > 0),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_loyalty_rewards_barberia_id
  ON public.loyalty_rewards (barberia_id);

-- -----------------------------------------------------------------------------
-- 4. TABLE: public.loyalty_redemptions (Business Record of Reward Redemptions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id BIGSERIAL PRIMARY KEY,
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  cliente_id INT NOT NULL REFERENCES public.clientes_finales(id) ON DELETE RESTRICT,
  reward_id INT REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  costo_sellos_snapshot INT NOT NULL CHECK (costo_sellos_snapshot > 0),
  operador_usuario_id INT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  cita_id INT REFERENCES public.citas(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_loyalty_redemptions_barberia_cliente
  ON public.loyalty_redemptions (barberia_id, cliente_id);

CREATE INDEX IF NOT EXISTS ix_loyalty_redemptions_reward_id
  ON public.loyalty_redemptions (reward_id);

-- -----------------------------------------------------------------------------
-- 5. TABLE: public.loyalty_ledger (Immutable Append-Only Transaction Ledger)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
  id BIGSERIAL PRIMARY KEY,
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  cliente_id INT NOT NULL REFERENCES public.clientes_finales(id) ON DELETE RESTRICT,
  delta INT NOT NULL CHECK (delta <> 0),
  tipo_movimiento VARCHAR(50) NOT NULL CHECK (tipo_movimiento IN ('acumulacion', 'canje', 'reversion', 'ajuste')),
  source_type VARCHAR(50),
  source_id INT,
  redemption_id BIGINT REFERENCES public.loyalty_redemptions(id) ON DELETE SET NULL,
  operador_usuario_id INT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_loyalty_ledger_delta_direction CHECK (
    (tipo_movimiento = 'acumulacion' AND delta > 0) OR
    (tipo_movimiento = 'canje' AND delta < 0) OR
    (tipo_movimiento IN ('reversion', 'ajuste') AND delta <> 0)
  )
);

CREATE INDEX IF NOT EXISTS ix_loyalty_ledger_tenant_cliente
  ON public.loyalty_ledger (barberia_id, cliente_id);

-- Idempotency protection for external events (e.g., payments/appointments)
CREATE UNIQUE INDEX IF NOT EXISTS ux_loyalty_ledger_source_idempotency
  ON public.loyalty_ledger (barberia_id, source_type, source_id, tipo_movimiento)
  WHERE source_id IS NOT NULL AND source_type IS NOT NULL;

-- 1:1 redemption linking idempotency protection
CREATE UNIQUE INDEX IF NOT EXISTS ux_loyalty_ledger_redemption
  ON public.loyalty_ledger (redemption_id)
  WHERE redemption_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 6. IMMUTABILITY & CROSS-TENANT INTEGRITY TRIGGERS
-- -----------------------------------------------------------------------------

-- Trigger A: Append-only enforcement on loyalty_ledger (no UPDATE or DELETE allowed)
CREATE OR REPLACE FUNCTION public.fn_prevent_loyalty_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'LOYALTY_LEDGER_IMMUTABLE: No se permite modificar o eliminar registros del ledger de lealtad.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_loyalty_ledger_mutation ON public.loyalty_ledger;
CREATE TRIGGER trg_prevent_loyalty_ledger_mutation
BEFORE UPDATE OR DELETE ON public.loyalty_ledger
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_loyalty_ledger_mutation();

-- Trigger B: Cross-tenant boundary validation on loyalty_ledger
CREATE OR REPLACE FUNCTION public.fn_loyalty_ledger_validate_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_barberia_id INT;
BEGIN
  SELECT barberia_id INTO v_cliente_barberia_id
  FROM public.clientes_finales
  WHERE id = NEW.cliente_id;

  IF v_cliente_barberia_id IS NULL THEN
    RAISE EXCEPTION 'LOYALTY_INVALID_CLIENT: Cliente % no existe', NEW.cliente_id;
  END IF;

  IF v_cliente_barberia_id <> NEW.barberia_id THEN
    RAISE EXCEPTION 'LOYALTY_CROSS_TENANT_VIOLATION: Cliente % pertenece a barberia %, no a %',
      NEW.cliente_id, v_cliente_barberia_id, NEW.barberia_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_ledger_validate_tenant ON public.loyalty_ledger;
CREATE TRIGGER trg_loyalty_ledger_validate_tenant
BEFORE INSERT OR UPDATE ON public.loyalty_ledger
FOR EACH ROW EXECUTE FUNCTION public.fn_loyalty_ledger_validate_tenant();

-- Trigger C: Cross-tenant boundary validation on loyalty_redemptions
CREATE OR REPLACE FUNCTION public.fn_loyalty_redemption_validate_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_barberia_id INT;
  v_reward_barberia_id INT;
BEGIN
  SELECT barberia_id INTO v_cliente_barberia_id
  FROM public.clientes_finales
  WHERE id = NEW.cliente_id;

  IF v_cliente_barberia_id IS NULL THEN
    RAISE EXCEPTION 'LOYALTY_INVALID_CLIENT: Cliente % no existe', NEW.cliente_id;
  END IF;

  IF v_cliente_barberia_id <> NEW.barberia_id THEN
    RAISE EXCEPTION 'LOYALTY_CROSS_TENANT_VIOLATION: Cliente % pertenece a barberia %, no a %',
      NEW.cliente_id, v_cliente_barberia_id, NEW.barberia_id;
  END IF;

  IF NEW.reward_id IS NOT NULL THEN
    SELECT barberia_id INTO v_reward_barberia_id
    FROM public.loyalty_rewards
    WHERE id = NEW.reward_id;

    IF v_reward_barberia_id IS NULL THEN
      RAISE EXCEPTION 'LOYALTY_INVALID_REWARD: Recompensa % no existe', NEW.reward_id;
    END IF;

    IF v_reward_barberia_id <> NEW.barberia_id THEN
      RAISE EXCEPTION 'LOYALTY_CROSS_TENANT_VIOLATION: Recompensa % pertenece a barberia %, no a %',
        NEW.reward_id, v_reward_barberia_id, NEW.barberia_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_redemption_validate_tenant ON public.loyalty_redemptions;
CREATE TRIGGER trg_loyalty_redemption_validate_tenant
BEFORE INSERT OR UPDATE ON public.loyalty_redemptions
FOR EACH ROW EXECUTE FUNCTION public.fn_loyalty_redemption_validate_tenant();

-- -----------------------------------------------------------------------------
-- 7. DERIVED VIEW: public.v_loyalty_client_balance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_loyalty_client_balance AS
SELECT
  cf.barberia_id,
  cf.id AS cliente_id,
  COALESCE(SUM(l.delta), 0)::BIGINT AS saldo_sellos,
  COUNT(l.id) FILTER (WHERE l.tipo_movimiento = 'acumulacion')::BIGINT AS total_acumulaciones,
  COUNT(l.id) FILTER (WHERE l.tipo_movimiento = 'canje')::BIGINT AS total_canjes,
  MAX(l.created_at) AS ultimo_movimiento_at
FROM public.clientes_finales cf
LEFT JOIN public.loyalty_ledger l
  ON l.cliente_id = cf.id
  AND l.barberia_id = cf.barberia_id
GROUP BY cf.barberia_id, cf.id;

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.barberia_loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberia_loyalty_config FORCE ROW LEVEL SECURITY;

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards FORCE ROW LEVEL SECURITY;

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger FORCE ROW LEVEL SECURITY;

-- 8.1 barberia_loyalty_config policies
DROP POLICY IF EXISTS loyalty_config_tenant_all ON public.barberia_loyalty_config;
CREATE POLICY loyalty_config_tenant_all ON public.barberia_loyalty_config
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = barberia_loyalty_config.barberia_id
      AND b.owner_id = public.jwt_user_id()
      AND b.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.barberia_miembros bm
    WHERE bm.barberia_id = barberia_loyalty_config.barberia_id
      AND bm.usuario_id = public.jwt_user_id()
      AND bm.activo = true
      AND bm.rol IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = barberia_loyalty_config.barberia_id
      AND b.owner_id = public.jwt_user_id()
      AND b.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.barberia_miembros bm
    WHERE bm.barberia_id = barberia_loyalty_config.barberia_id
      AND bm.usuario_id = public.jwt_user_id()
      AND bm.activo = true
      AND bm.rol IN ('owner', 'admin')
  )
);

-- 8.2 loyalty_rewards policies
DROP POLICY IF EXISTS loyalty_rewards_tenant_all ON public.loyalty_rewards;
CREATE POLICY loyalty_rewards_tenant_all ON public.loyalty_rewards
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = loyalty_rewards.barberia_id
      AND b.owner_id = public.jwt_user_id()
      AND b.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.barberia_miembros bm
    WHERE bm.barberia_id = loyalty_rewards.barberia_id
      AND bm.usuario_id = public.jwt_user_id()
      AND bm.activo = true
      AND bm.rol IN ('owner', 'admin', 'cajero', 'barbero')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = loyalty_rewards.barberia_id
      AND b.owner_id = public.jwt_user_id()
      AND b.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.barberia_miembros bm
    WHERE bm.barberia_id = loyalty_rewards.barberia_id
      AND bm.usuario_id = public.jwt_user_id()
      AND bm.activo = true
      AND bm.rol IN ('owner', 'admin')
  )
);

-- 8.3 loyalty_redemptions policies (Read-only for authenticated staff; mutations via controlled RPCs in Phase 2)
DROP POLICY IF EXISTS loyalty_redemptions_tenant_all ON public.loyalty_redemptions;
DROP POLICY IF EXISTS loyalty_redemptions_tenant_select ON public.loyalty_redemptions;
CREATE POLICY loyalty_redemptions_tenant_select ON public.loyalty_redemptions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = loyalty_redemptions.barberia_id
      AND b.owner_id = public.jwt_user_id()
      AND b.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.barberia_miembros bm
    WHERE bm.barberia_id = loyalty_redemptions.barberia_id
      AND bm.usuario_id = public.jwt_user_id()
      AND bm.activo = true
      AND bm.rol IN ('owner', 'admin', 'cajero')
  )
);

-- 8.4 loyalty_ledger policies (Read-only for authenticated staff; mutations via controlled RPCs in Phase 2)
DROP POLICY IF EXISTS loyalty_ledger_tenant_all ON public.loyalty_ledger;
DROP POLICY IF EXISTS loyalty_ledger_tenant_select ON public.loyalty_ledger;
CREATE POLICY loyalty_ledger_tenant_select ON public.loyalty_ledger
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barberias b
    WHERE b.id = loyalty_ledger.barberia_id
      AND b.owner_id = public.jwt_user_id()
      AND b.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.barberia_miembros bm
    WHERE bm.barberia_id = loyalty_ledger.barberia_id
      AND bm.usuario_id = public.jwt_user_id()
      AND bm.activo = true
      AND bm.rol IN ('owner', 'admin', 'cajero', 'barbero')
  )
);

-- -----------------------------------------------------------------------------
-- 9. PERMISSIONS & ROLE GRANTS
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.barberia_loyalty_config TO anon;
GRANT SELECT ON public.loyalty_rewards TO anon;
GRANT SELECT ON public.loyalty_redemptions TO anon;
GRANT SELECT ON public.loyalty_ledger TO anon;
GRANT SELECT ON public.v_loyalty_client_balance TO anon;

GRANT SELECT, INSERT, UPDATE ON public.barberia_loyalty_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_rewards TO authenticated;
GRANT SELECT ON public.loyalty_redemptions TO authenticated;
GRANT SELECT ON public.loyalty_ledger TO authenticated;
GRANT SELECT ON public.v_loyalty_client_balance TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE public.loyalty_rewards_id_seq TO authenticated;

COMMIT;
