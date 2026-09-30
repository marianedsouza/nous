import { Router } from 'express';
import { q, q1 } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Historico recente (temperaturas + amostras)
router.get('/', wrap(async (req, res) => {
  const temps = await q('SELECT * FROM temps ORDER BY id DESC LIMIT 50');
  const samples = await q('SELECT * FROM samples ORDER BY id DESC LIMIT 50');
  const att = await q1("SELECT COUNT(*)::int AS c FROM temps WHERE status <> 'Conforme'");
  res.json({ temps, samples, attention: att ? att.c : 0 });
}));

// Registrar temperatura (RT e Cozinha)
router.post('/temps', requireRole('rt', 'cozinha'), wrap(async (req, res) => {
  const { type, place, value, status } = req.body || {};
  if (!type || !place || value == null || !status) {
    return res.status(400).json({ error: 'Campos obrigatorios: type, place, value, status' });
  }
  const dt = new Date().toLocaleString('pt-BR');
  const r = await q1(
    'INSERT INTO temps (dt, type, place, value, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [dt, type, place, Number(value), status]
  );
  res.status(201).json(r);
}));

// Registrar amostra (RT e Cozinha)
router.post('/samples', requireRole('rt', 'cozinha'), wrap(async (req, res) => {
  const { prep, time } = req.body || {};
  if (!prep || !time) return res.status(400).json({ error: 'Campos obrigatorios: prep, time' });
  const date = new Date().toLocaleDateString('pt-BR');
  const r = await q1('INSERT INTO samples (date, prep, time) VALUES ($1,$2,$3) RETURNING *', [date, prep, time]);
  res.status(201).json(r);
}));

export default router;
