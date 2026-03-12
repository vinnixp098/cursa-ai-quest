# Cursa AI Quest - Gerador de Simulados com IA

Gere questões de concursos e provas personalizadas usando Gemini AI.

## 🚀 Deploy no Vercel (Recomendado)

1. **Push para GitHub** e conecte no Vercel
2. **Adicione variável de ambiente:**
   ```
   GEMINI_API_KEY = sua_chave_gemini_aqui
   ```
   (Obtenha em https://aistudio.google.com/app/apikey)
3. **Deploy automático** ✅

## 🏃‍♂️ Local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`

**Nota:** Localmente, crie `src/.env` com `GEMINI_API_KEY=...` para testar (gitignore'd).

## 🔒 Segurança

- Chave API **server-side only** (proxy /api/gemini)
- Sem exposição client-side
- Vercel env vars auto-carregadas em `process.env`

## 📱 Funcionalidades

- Temas/bancas customizáveis
- Quantidade de questões
- Timer opcional
- Correção automática + explicações
- Export PDF

Feito com ❤️ usando Google Gemini + Vercel + Express
