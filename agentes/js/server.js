require('dotenv').config();

const express = require('express');
const { runJefe } = require('./jefe');

const app = express();
app.use(express.json());

app.post('/agents/run', async (req, res) => {
  try {
    const { request } = req.body;

    if (!request) {
      return res.status(400).json({
        ok: false,
        error: 'Falta request'
      });
    }

    const result = await runJefe({ request });

    res.json({
      ok: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`🚀 API de agentes corriendo en http://localhost:${PORT}`);
});