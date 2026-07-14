const fs = require('fs');
const path = require('path');
const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('\n========================================');
    console.log('STARTING CORRECTIVE STAGING MIGRATION (STEP 7)');
    console.log('========================================\n');

    const migrationPath = path.resolve(__dirname, '../migrations/20260713_2032_harden_billing_worker_role.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    
    // We clean comments and split statements
    let cleaned = sqlContent.replace(/\/\*[\s\S]*?\*\//g, '');
    let lines = cleaned.split('\n');
    let noComments = lines.map(line => {
      let trimmed = line.trim();
      let upper = trimmed.toUpperCase();
      if (trimmed.startsWith('--') || trimmed.startsWith('- ') || upper === 'BEGIN;' || upper === 'COMMIT;') {
        return '';
      }
      let idx = line.indexOf('--');
      if (idx !== -1) {
        return line.substring(0, idx);
      }
      return line;
    }).join('\n');

    let statements = [];
    let current = '';
    let currentDollarTag = null;
    let inSingleQuote = false;
    
    for (let i = 0; i < noComments.length; i++) {
      let char = noComments[i];
      if (char === '$' && !inSingleQuote) {
        if (currentDollarTag) {
          let isClose = true;
          for (let j = 0; j < currentDollarTag.length; j++) {
            if (noComments[i + j] !== currentDollarTag[j]) {
              isClose = false;
              break;
            }
          }
          if (isClose) {
            current += currentDollarTag;
            i += currentDollarTag.length - 1;
            currentDollarTag = null;
            continue;
          }
        } else {
          let match = noComments.substring(i).match(/^\$[a-zA-Z_0-9]*\$/);
          if (match) {
            currentDollarTag = match[0];
            current += currentDollarTag;
            i += currentDollarTag.length - 1;
            continue;
          }
        }
      }
      
      if (char === "'" && !currentDollarTag) {
        inSingleQuote = !inSingleQuote;
      }
      
      if (char === ';' && !currentDollarTag && !inSingleQuote) {
        let stmt = current.trim();
        let upper = stmt.toUpperCase();
        if (stmt && upper !== 'BEGIN' && upper !== 'COMMIT') {
          statements.push(stmt + ';');
        }
        current = '';
      } else {
        current += char;
      }
    }
    
    let stmt = current.trim();
    if (stmt) {
      statements.push(stmt);
    }

    console.log(`Parsed ${statements.length} commands to execute.`);

    for (let sIdx = 0; sIdx < statements.length; sIdx++) {
      const sql = statements[sIdx];
      console.log(`Executing [${sIdx + 1}/${statements.length}]: ${sql.substring(0, 80)}...`);
      try {
        await runSQL(sql);
      } catch (err) {
        throw new Error(`Failed to execute statement ${sIdx + 1}: ${err.message}\nSQL: ${sql}`);
      }
    }

    console.log('\nMigration executed successfully. Running postcheck...');
    const rolesCheck = await runSQL("SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit FROM pg_roles WHERE rolname = 'n8n_billing_worker_role';");
    console.log('Roles Verification:', JSON.stringify(rolesCheck, null, 2));

    const functionsCheck = await runSQL(`
      SELECT routine_name, security_type
      FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'billing_create_checkout_backend';
    `);
    console.log('Functions Verification:', JSON.stringify(functionsCheck, null, 2));

    const grantsCheck = await runSQL(`
      SELECT table_name, privilege_type, grantee 
      FROM information_schema.role_table_grants 
      WHERE table_schema = 'public' 
        AND grantee = 'n8n_billing_worker_role'
      ORDER BY table_name, privilege_type ASC;
    `);
    console.log('Grants Verification:', JSON.stringify(grantsCheck, null, 2));

    const functionGrantsCheck = await runSQL(`
      SELECT routine_name, grantee, privilege_type 
      FROM information_schema.routine_privileges 
      WHERE routine_schema = 'public' 
        AND (grantee = 'n8n_billing_worker_role' OR grantee = 'PUBLIC')
        AND routine_name = 'billing_create_checkout_backend';
    `);
    console.log('Function Grants Verification:', JSON.stringify(functionGrantsCheck, null, 2));

    console.log('\n========================================');
    console.log('CORRECTIVE MIGRATION COMPLETED SUCCESSFULLY');
    console.log('========================================\n');

  } catch (err) {
    console.error('\n!!! MIGRATION FAILED !!!');
    console.error(err.message || err);
    process.exit(1);
  } finally {
    await cleanup();
  }
})();
