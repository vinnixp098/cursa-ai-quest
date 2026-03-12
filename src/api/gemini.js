const MODELS = [
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite-001",
    "gemini-flash-lite-latest"
];

import { GEMINI_API_KEY } from './env.js';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(prompt) {
    let lastError = null;

    for (const model of MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log("Tentando modelo:", model, "tentativa:", attempt);

                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": GEMINI_API_KEY
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [{ text: prompt }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.7
                        }
                    })
                });

                const data = await response.json();
                console.log("Resposta Gemini:", data);

                if (data.error) {
                    lastError = data.error;

                    if (data.error.code === 503) {
                        await sleep(1200 * attempt);
                        continue;
                    }

                    if (data.error.code === 429) {
                        await sleep(2000 * attempt);
                        continue;
                    }

                    throw new Error(`${data.error.code}: ${data.error.message}`);
                }

                return { data, model };
            } catch (err) {
                lastError = err;
                await sleep(1000 * attempt);
            }
        }
    }

    throw new Error(
        typeof lastError === "object" && lastError?.message
            ? lastError.message
            : "Não foi possível gerar com nenhum modelo."
    );
}

// Export for dynamic import in browser
export { callGemini };

