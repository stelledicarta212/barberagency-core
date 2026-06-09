const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('--- STARTING MIGRATION ---');

    // 1. Create table public.barberia_miembros
    console.log('Creating public.barberia_miembros table...');
    await runSQL(`
      CREATE TABLE IF NOT EXISTS public.barberia_miembros (
        id SERIAL PRIMARY KEY,
        barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
        usuario_id INT REFERENCES public.usuarios(id) ON DELETE SET NULL,
        email VARCHAR(255) NOT NULL,
        rol VARCHAR(50) NOT NULL CHECK (rol IN ('owner', 'admin', 'barbero', 'cajero')),
        activo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Migrate existing owners as members
    console.log('Migrating owners...');
    const migrationResult = await runSQL(`
      INSERT INTO public.barberia_miembros (barberia_id, usuario_id, email, rol, activo)
      SELECT b.id, b.owner_id, u.email, 'owner', true
      FROM public.barberias b
      JOIN public.usuarios u ON b.owner_id = u.id
      WHERE b.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.barberia_miembros bm 
          WHERE bm.barberia_id = b.id AND bm.usuario_id = b.owner_id AND bm.rol = 'owner'
        );
    `);
    console.log('Owners migrated:', migrationResult);

    // 3. Create explicit member for calvis590@gmail.com on barberia 198
    console.log('Creating explicit admin access for calvis590@gmail.com on barberia 198...');
    const adminResult = await runSQL(`
      INSERT INTO public.barberia_miembros (barberia_id, usuario_id, email, rol, activo)
      SELECT 198, u.id, 'calvis590@gmail.com', 'admin', true
      FROM public.usuarios u
      WHERE lower(u.email) = 'calvis590@gmail.com'
        AND NOT EXISTS (
          SELECT 1 FROM public.barberia_miembros bm 
          WHERE bm.barberia_id = 198 AND lower(bm.email) = 'calvis590@gmail.com'
        );
    `);
    console.log('Admin record inserted:', adminResult);

    // 4. Enable RLS and Create Policies
    console.log('Enabling Row Level Security...');
    await runSQL(`ALTER TABLE public.barberia_miembros ENABLE ROW LEVEL SECURITY;`).catch(e => console.log('RLS already enabled or error:', e.message));

    console.log('Creating policies...');
    await runSQL(`
      DROP POLICY IF EXISTS barberia_miembros_owner_all ON public.barberia_miembros;
      CREATE POLICY barberia_miembros_owner_all
        ON public.barberia_miembros
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.barberias b
            WHERE b.id = barberia_miembros.barberia_id AND b.owner_id = jwt_user_id()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.barberias b
            WHERE b.id = barberia_miembros.barberia_id AND b.owner_id = jwt_user_id()
          )
        );
    `).catch(e => console.log('Error creating owner policy:', e.message));

    await runSQL(`
      DROP POLICY IF EXISTS barberia_miembros_member_select ON public.barberia_miembros;
      CREATE POLICY barberia_miembros_member_select
        ON public.barberia_miembros
        FOR SELECT
        TO authenticated
        USING (
          usuario_id = jwt_user_id() OR
          lower(email) = lower((SELECT email FROM public.usuarios WHERE id = jwt_user_id()))
        );
    `).catch(e => console.log('Error creating member select policy:', e.message));

    console.log('--- MIGRATION COMPLETED ---');

    console.log('\n--- VERIFYING MIGRATED MEMBERS (SAMPLE) ---');
    const sample = await runSQL(`SELECT * FROM public.barberia_miembros LIMIT 10;`);
    console.log('Sample members:', JSON.stringify(sample, null, 2));

    console.log('\n--- VERIFYING calvis590 ACCESS ---');
    const calvisAccess = await runSQL(`
      SELECT * FROM public.barberia_miembros 
      WHERE lower(email) = 'calvis590@gmail.com';
    `);
    console.log('calvis590 access:', JSON.stringify(calvisAccess, null, 2));

  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await cleanup();
  }
})();
