const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const root = path.resolve(__dirname, "..");
const fixtureSql = fs.readFileSync(path.join(__dirname, "fixtures", "pos_minimal_schema.sql"), "utf8");
const migrationSql = fs.readFileSync(
  path.join(root, "migrations", "20260723_2245_pos_charge_only_after_service.sql"),
  "utf8"
);
const rollbackSql = fs.readFileSync(
  path.join(root, "migrations", "20260723_2245_pos_charge_only_after_service_rollback.sql"),
  "utf8"
);
const connectionString =
  process.env.POS_TEST_DATABASE_URL ||
  "postgres://postgres:postgres@127.0.0.1:55432/barberagency_pos_test";

let total = 0;
let passed = 0;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function test(name, fn) {
  total += 1;
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${total}: ${name}`);
  } catch (error) {
    console.error(`FAIL ${total}: ${name}`);
    throw error;
  }
}

async function expectSqlError(client, sql, params, pattern) {
  await client.query("SAVEPOINT expected_error");
  try {
    await client.query(sql, params);
    assert.fail("SQL statement was expected to fail");
  } catch (error) {
    assert.match(error.message, pattern);
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT expected_error");
    await client.query("RELEASE SAVEPOINT expected_error");
  }
}

async function insertCita(client, estado, suffix) {
  const result = await client.query(
    `INSERT INTO public.citas
       (barberia_id, barbero_id, servicio_id, fecha, hora_inicio, cliente_nombre, estado)
     VALUES (10, 100, 200, DATE '2026-07-27', TIME '10:00', $1, $2)
     RETURNING id`,
    [`Cliente ${suffix}`, estado]
  );
  return result.rows[0].id;
}

async function advanceTo(client, citaId, target) {
  const states = ["confirmada", "en_servicio", "realizada"];
  for (const state of states) {
    await client.query("UPDATE public.citas SET estado = $1 WHERE id = $2", [state, citaId]);
    if (state === target) return;
  }
}

async function charge(client, barberiaId, citaId, amount = 20000) {
  const result = await client.query(
    "SELECT public.fn_pos_registrar_pago_realizada($1, $2, $3, $4) AS result",
    [barberiaId, citaId, amount, "efectivo"]
  );
  return result.rows[0].result;
}

async function main() {
  const admin = new Client({ connectionString });
  await admin.connect();

  try {
    await admin.query(fixtureSql);
    await admin.query(rollbackSql);
    await admin.query(`
      DROP TRIGGER IF EXISTS trg_citas_set_y_validar ON public.citas;
      CREATE TRIGGER trg_citas_set_y_validar
      BEFORE INSERT OR UPDATE ON public.citas
      FOR EACH ROW EXECUTE FUNCTION public.fn_citas_set_y_validar();

      INSERT INTO public.barberias (id, name, slot_min) VALUES
        (10, 'Tenant A', 1),
        (20, 'Tenant B', 1);
      INSERT INTO public.barberos (id, barberia_id, name) VALUES
        (100, 10, 'Barbero A'),
        (200, 20, 'Barbero B');
      INSERT INTO public.servicios (id, barberia_id, duracion_min) VALUES
        (200, 10, 30),
        (201, 10, 0),
        (300, 20, 30);
      INSERT INTO public.horarios (barberia_id, dia_semana, hora_abre, hora_cierra, activo)
      SELECT id, dow, TIME '00:00', TIME '23:59:59', true
      FROM public.barberias CROSS JOIN generate_series(0, 6) AS dow;
    `);

    const original = await admin.query(
      "SELECT pg_get_functiondef('public.fn_citas_set_y_validar()'::regprocedure) AS definition"
    );
    const originalHash = sha256(original.rows[0].definition);
    await admin.query(migrationSql);

    await test("INSERT pendiente permitido", async () => {
      assert.ok(await insertCita(admin, "pendiente", "insert-pendiente"));
    });
    await test("INSERT confirmada permitido", async () => {
      assert.ok(await insertCita(admin, "confirmada", "insert-confirmada"));
    });
    await test("INSERT realizada rechazado", async () => {
      await admin.query("BEGIN");
      await expectSqlError(
        admin,
        `INSERT INTO public.citas
          (barberia_id, barbero_id, servicio_id, fecha, hora_inicio, cliente_nombre, estado)
         VALUES (10, 100, 200, DATE '2026-07-27', TIME '10:00', 'invalida', 'realizada')`,
        [],
        /Estado inicial/
      );
      await admin.query("COMMIT");
    });
    await test("INSERT pagada rechazado", async () => {
      await admin.query("BEGIN");
      await expectSqlError(
        admin,
        `INSERT INTO public.citas
          (barberia_id, barbero_id, servicio_id, fecha, hora_inicio, cliente_nombre, estado)
         VALUES (10, 100, 200, DATE '2026-07-27', TIME '10:00', 'invalida', 'pagada')`,
        [],
        /pagada sin un registro de pago|Estado inicial/
      );
      await admin.query("COMMIT");
    });

    for (const [from, to] of [
      ["pendiente", "confirmada"],
      ["pendiente", "cancelada"],
      ["confirmada", "en_servicio"],
      ["confirmada", "cancelada"],
      ["confirmada", "no_asistio"],
      ["en_servicio", "realizada"]
    ]) {
      await test(`${from} -> ${to} permitido`, async () => {
        const id = await insertCita(admin, from === "pendiente" ? "pendiente" : "confirmada", `${from}-${to}`);
        if (from === "en_servicio") {
          await admin.query("UPDATE public.citas SET estado = 'en_servicio' WHERE id = $1", [id]);
        }
        await admin.query("UPDATE public.citas SET estado = $1 WHERE id = $2", [to, id]);
      });
    }

    for (const [from, to] of [
      ["pendiente", "realizada"],
      ["confirmada", "pagada"],
      ["pagada", "confirmada"],
      ["cancelada", "confirmada"]
    ]) {
      await test(`${from} -> ${to} rechazado`, async () => {
        const id = await insertCita(admin, from === "pendiente" ? "pendiente" : "confirmada", `invalid-${from}-${to}`);
        if (from === "pagada") {
          await admin.query("UPDATE public.citas SET estado = 'en_servicio' WHERE id = $1", [id]);
          await admin.query("UPDATE public.citas SET estado = 'realizada' WHERE id = $1", [id]);
          assert.equal((await charge(admin, 10, id)).ok, true);
        } else if (from === "cancelada") {
          await admin.query("UPDATE public.citas SET estado = 'cancelada' WHERE id = $1", [id]);
        }
        await admin.query("BEGIN");
        await expectSqlError(
          admin,
          "UPDATE public.citas SET estado = $1 WHERE id = $2",
          [to, id],
          /Transici.n de estado inv.lida|estado final|pagada sin un registro/
        );
        await admin.query("COMMIT");
      });
    }

    for (const estado of ["pendiente", "confirmada", "en_servicio"]) {
      await test(`cita ${estado} no cobrable`, async () => {
        const id = await insertCita(admin, estado === "pendiente" ? "pendiente" : "confirmada", `charge-${estado}`);
        if (estado === "en_servicio") {
          await admin.query("UPDATE public.citas SET estado = 'en_servicio' WHERE id = $1", [id]);
        }
        const result = await charge(admin, 10, id);
        assert.equal(result.ok, false);
        assert.equal(result.code, "cita_no_realizada");
      });
    }

    let paidCitaId;
    await test("cita realizada cobrable, pasa a pagada y crea exactamente un pago", async () => {
      paidCitaId = await insertCita(admin, "pendiente", "charge-ok");
      await advanceTo(admin, paidCitaId, "realizada");
      assert.equal((await charge(admin, 10, paidCitaId)).ok, true);
      const state = await admin.query("SELECT estado FROM public.citas WHERE id = $1", [paidCitaId]);
      const count = await admin.query("SELECT count(*)::int AS count FROM public.pagos WHERE cita_id = $1", [paidCitaId]);
      assert.equal(state.rows[0].estado, "pagada");
      assert.equal(count.rows[0].count, 1);
    });
    await test("doble cobro rechazado", async () => {
      const result = await charge(admin, 10, paidCitaId);
      assert.equal(result.ok, false);
      assert.equal(result.code, "cita_ya_pagada");
    });
    await test("tenant distinto rechazado", async () => {
      const id = await insertCita(admin, "pendiente", "tenant");
      await advanceTo(admin, id, "realizada");
      const result = await charge(admin, 20, id);
      assert.equal(result.ok, false);
      assert.equal(result.code, "cita_ajena");
    });
    await test("monto negativo rechazado", async () => {
      const id = await insertCita(admin, "pendiente", "negative");
      await advanceTo(admin, id, "realizada");
      const result = await charge(admin, 10, id, -1);
      assert.equal(result.ok, false);
      assert.equal(result.code, "monto_negativo");
    });
    await test("venta mostrador crea cita y pago atomicamente", async () => {
      const response = await admin.query(
        "SELECT public.fn_pos_registrar_venta_mostrador(10, 100, 201, 25000, 'efectivo', 'Mostrador', NULL) AS result"
      );
      const result = response.rows[0].result;
      assert.equal(result.ok, true);
      const rows = await admin.query(
        `SELECT c.estado, count(p.id)::int AS payment_count
         FROM public.citas c JOIN public.pagos p ON p.cita_id = c.id
         WHERE c.id = $1 GROUP BY c.estado`,
        [result.cita_id]
      );
      assert.deepEqual(rows.rows[0], { estado: "pagada", payment_count: 1 });
    });

    let concurrentPaymentCount = 0;
    await test("dos conexiones concurrentes producen un exito y cita_ya_pagada", async () => {
      const citaId = await insertCita(admin, "pendiente", "concurrency");
      await advanceTo(admin, citaId, "realizada");
      const first = new Client({ connectionString });
      const second = new Client({ connectionString });
      await Promise.all([first.connect(), second.connect()]);
      try {
        const settled = await Promise.allSettled([
          charge(first, 10, citaId, 30000),
          charge(second, 10, citaId, 30000)
        ]);
        assert.ok(settled.every((entry) => entry.status === "fulfilled"));
        const values = settled.map((entry) => entry.value);
        assert.equal(values.filter((value) => value.ok === true).length, 1);
        assert.equal(values.filter((value) => value.code === "cita_ya_pagada").length, 1);
        const count = await admin.query("SELECT count(*)::int AS count FROM public.pagos WHERE cita_id = $1", [citaId]);
        const state = await admin.query("SELECT estado FROM public.citas WHERE id = $1", [citaId]);
        concurrentPaymentCount = count.rows[0].count;
        assert.equal(concurrentPaymentCount, 1);
        assert.equal(state.rows[0].estado, "pagada");
      } finally {
        await Promise.all([first.end(), second.end()]);
      }
    });

    await admin.query(rollbackSql);
    const restored = await admin.query(
      "SELECT pg_get_functiondef('public.fn_citas_set_y_validar()'::regprocedure) AS definition"
    );
    const rollbackHash = sha256(restored.rows[0].definition);
    await test("rollback restaura hash original y elimina funciones POS", async () => {
      assert.equal(rollbackHash, originalHash);
      const functions = await admin.query(`
        SELECT
          to_regprocedure('public.fn_pos_registrar_pago_realizada(integer,integer,numeric,text)') AS charge,
          to_regprocedure('public.fn_pos_registrar_venta_mostrador(integer,integer,integer,numeric,text,text,text)') AS counter
      `);
      assert.equal(functions.rows[0].charge, null);
      assert.equal(functions.rows[0].counter, null);
    });

    console.log(`POSTGRES_VERSION=${(await admin.query("SHOW server_version")).rows[0].server_version}`);
    console.log(`ORIGINAL_TRIGGER_HASH=${originalHash}`);
    console.log(`ROLLBACK_TRIGGER_HASH=${rollbackHash}`);
    console.log(`ROLLBACK_HASH_MATCH=${rollbackHash === originalHash}`);
    console.log(`REAL_CONCURRENT_CONNECTIONS=2`);
    console.log(`REAL_CONCURRENCY_PAYMENT_COUNT=${concurrentPaymentCount}`);
    console.log(`REAL_POSTGRES_TEST_COUNT=${total}`);
    console.log(`REAL_POSTGRES_PASS_COUNT=${passed}`);
  } finally {
    await admin.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
