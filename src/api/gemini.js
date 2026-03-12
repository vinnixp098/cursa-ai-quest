// Client-side proxy to secure /api/gemini (server handles key securely)
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(prompt) {
    try {
        console.log("Chamando proxy seguro /api/gemini...");
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log("Resposta proxy:", result);
        return result; // { data, model }
    } catch (error) {
        console.error("Erro proxy:", error);
        throw error;
    }
}

// Export for dynamic import in browser
export { callGemini };


