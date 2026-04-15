require('dotenv').config();

const { runJefe } = require('./jefe');

async function main() {
  try {
    const result = await runJefe({
      request: 'crea un archivo HTML completo de una landing sencilla para barbería, responsive, con hero, servicios y formulario. Devuelve solo código HTML listo para guardar.'
    });

    console.log('\n🧠 PLAN DE AGENTES:');
    console.log(result.plan);

    console.log('\n⚙️ RESULTADO FINAL:');
    console.log(JSON.stringify(result.chainResult, null, 2));

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error(error.message);
  }
}

main();