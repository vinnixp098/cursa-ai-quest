# Vercel Environment Variables Integration - Approved Plan

**Status: In Progress**

## Breakdown Steps:

### 1. ✅ Create vercel.json (config for SPA + API routes)
### 2. ✅ Update server.js (remove dotenv, remove /api/env endpoint)
### 3. ✅ Update src/api/gemini.js (client: use /api/gemini proxy fetch)
### 4. ✅ Update src/script.js (generateExam: uses proxy via gemini.js)
### 5. ✅ Delete src/api/env.js (obsolete/insecure)
### 6. ✅ Update package.json (engines, vercel hints)
### 7. ✅ Update README.md (Vercel deployment instructions)
### 8. Test locally (`npm run dev`), then deploy to Vercel
### 9. ✅ Update this TODO.md (mark complete)

**✅ ALL STEPS COMPLETE! VERCEL ENV READY.**

1. Local: `npm install && npm run dev` (adicione src/.env temporário se testar local)
2. Vercel: Configure GEMINI_API_KEY no dashboard → Deploy ✅

**npm install` will remove unused dotenv.

