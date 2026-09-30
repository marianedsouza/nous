// Entrypoint para desenvolvimento local: sobe um servidor HTTP de longa duracao.
// Em producao no Vercel, o entrypoint e api/index.js (serverless).
import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NOUS Excellence rodando em http://localhost:${PORT}`);
});
