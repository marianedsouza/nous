// App para DEV LOCAL: serve a API + os arquivos estaticos de public/.
// Em producao (Vercel), os estaticos sao servidos pelo CDN e a funcao usa server/api.js.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiApp from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();

// 1) API primeiro (inclui o 404 de /api)
app.use(apiApp);

// 2) Arquivos estaticos
app.use(express.static(PUBLIC_DIR));

// 3) Paginas (fallback simples)
app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

export default app;
