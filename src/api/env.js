// Dynamic .env loader for browser (fetch as text module)
// Add your src/.env content below (manual copy) or use fetch if served.
const ENV_CONTENT = `
# Coloque sua chave aqui (copie de src/.env)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
`;

const envVars = {};
ENV_CONTENT.trim().split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim().replace(/"/g, '');
    envVars[key] = value;
  }
});

export const GEMINI_API_KEY = envVars.GEMINI_API_KEY || 'FALLBACK_KEY_MISSING';
export default envVars;

