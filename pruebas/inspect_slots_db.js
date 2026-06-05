const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    
    console.log('\n--- BARBERIAS ---');
    const barberias = await runSQL(
      "SELECT id, nombre, slug, estado, deleted_at, slot_min FROM public.barberias WHERE id = 198 OR slug = 'barberia-prueba-4';"
    );
    console.log(JSON.stringify(barberias, null, 2));

    console.log('\n--- SERVICIOS ---');
    const servicios = await runSQL(
      "SELECT id, barberia_id, nombre, duracion_min, precio, activo FROM public.servicios WHERE barberia_id = 198;"
    );
    console.log(JSON.stringify(servicios, null, 2));

    console.log('\n--- BARBEROS ---');
    const barberos = await runSQL(
      "SELECT id, barberia_id, nombre, activo FROM public.barberos WHERE barberia_id = 198;"
    );
    console.log(JSON.stringify(barberos, null, 2));

    console.log('\n--- HORARIOS ---');
    const horarios = await runSQL(
      "SELECT dia_semana, hora_abre, hora_cierra, activo FROM public.horarios WHERE barberia_id = 198 ORDER BY dia_semana;"
    );
    console.log(JSON.stringify(horarios, null, 2));

    console.log('\n--- DESCANSOS ---');
    const descansos = await runSQL(
      "SELECT * FROM public.barberos_descansos WHERE barberia_id = 198;"
    );
    console.log(JSON.stringify(descansos, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
