// App Express com APENAS a API. Compartilhado entre:
//  - dev local (server/app.js adiciona os estaticos por cima)
//  - Vercel (api/index.js usa este app; os estaticos sao servidos pelo CDN)
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';

import './db.js';
import { ensureSeeded } from './seed.js';

import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menus.js';
import sheetRoutes from './routes/sheets.js';
import productionRoutes from './routes/production.js';
import docRoutes from './routes/docs.js';
import employeeRoutes from './routes/employees.js';
import qualityRoutes from './routes/quality.js';
import costRoutes from './routes/costs.js';
import dailyRoutes from './routes/daily.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Bootstrap idempotente: popula a demonstracao so se o banco estiver vazio.
// Memoizado por instancia; roda uma vez por cold start.
let bootstrapPromise = null;
app.use((req, res, next) => {
  if (!bootstrapPromise) bootstrapPromise = ensureSeeded().catch((e) => { bootstrapPromise = null; throw e; });
  bootstrapPromise.then(() => next()).catch(next);
});

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/api/auth', authRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/sheets', sheetRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/costs', costRoutes);
app.use('/api/daily', dailyRoutes);

// 404 para rotas de API inexistentes
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota nao encontrada' }));

// Handler de erros (JSON)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isUpload = err instanceof multer.MulterError;
  let status = err.status || 500;
  if (isUpload && err.code === 'LIMIT_FILE_SIZE') status = 413;
  else if (err.message?.includes('nao permitido')) status = 400;
  if (status >= 500) console.error('[erro]', err.message);
  res.status(status).json({ error: err.message || 'Erro interno' });
});

export default app;
