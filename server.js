const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('src'));


// Proxy Gemini API (secure - key server-side only)
app.post('/api/gemini', async (req, res) => {
  const { prompt, models = ["gemini-2.0-flash", "gemini-2.5-flash"] } = req.body;
  
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'API key missing' });

  try {
    // Gemini logic (same as before)
    const MODELS = models;
    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY 
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 }
        })
      });

      if (response.ok) {
        const data = await response.json();
        return res.json({ data, model });
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
    res.status(503).json({ error: 'All models failed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log('Chave carregada:', process.env.GEMINI_API_KEY ? '✅ (Vercel env)' : '❌');
});


