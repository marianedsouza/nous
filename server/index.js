import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './db.js';
import { ensureSeeded } from './seed.js';
import { requireAuth } from './auth.js';

import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menus.js';
import sheetRoutes from './routes/sheets.js';
import productionRoutes from './routes/production.js';
import docRoutes from './routes/docs.js';
import employeeRoutes from './routes/employees.js';
import qualityRoutes from './routes/quality.js';
import costRoutes from './routes/costs.js';
import dailyRoutes from './routes/daily.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

ensureSeeded();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---- API ----
app.use('/api/auth', authRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/sheets', sheetRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/costs', costRoutes);
app.use('/api/daily', dailyRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// ---- Frontend estatico ----
app.use(express.static(PUBLIC_DIR));

// Login page
app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));

// App (SPA-ish): protege a rota raiz redirecionando para login se nao autenticado
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// 404 para API
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota nao encontrada' }));

// Handler de erros
app.use((err, req, res, next) => {
  console.error('[erro]', err.message);
  const status = err.status || (err.message?.includes('nao permitido') ? 400 : 500);
  res.status(status).json({ error: err.message || 'Erro interno' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NOUS Excellence rodando em http://localhost:${PORT}`);
});
