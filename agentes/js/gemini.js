require('dotenv').config();

const fetch = require('node-fetch');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function runGemini(prompt, options = {}) {
  try {
    const model = options.model || "openai/gpt-4o-mini";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800 // 🔥 límite para ahorrar
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter error:", data);
      throw new Error(data.error?.message || "Error en OpenRouter");
    }

    return data.choices?.[0]?.message?.content || "Sin respuesta del modelo";

  } catch (error) {
    console.error("Error runGemini:", error.message);
    return "Sin respuesta del modelo";
  }
}

module.exports = { runGemini };