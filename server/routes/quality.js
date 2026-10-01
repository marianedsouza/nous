import { Router } from 'express';
import { sb, many, single, countOf } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Historico recente (temperaturas + amostras)
router.get('/', wrap(async (req, res) => {
  const temps = await many(sb.from('temps').select('*').order('id', { ascending: false }).limit(50));
  const samples = await many(sb.from('samples').select('*').order('id', { ascending: false }).limit(50));
  const attention = await countOf(sb.from('temps').select('*', { count: 'exact', head: true }).neq('status', 'Conforme'));
  res.json({ temps, samples, attention });
}));

// Registrar temperatura (RT e Cozinha)
router.post('/temps', requireRole('rt', 'cozinha'), wrap(async (req, res) => {
  const { type, place, value, status } = req.body || {};
  if (!type || !place || value == null || !status) {
    return res.status(400).json({ error: 'Campos obrigatorios: type, place, value, status' });
  }
  const dt = new Date().toLocaleString('pt-BR');
  const r = await single(sb.from('temps').insert({ dt, type, place, value: Number(value), status }).select());
  res.status(201).json(r);
}));

// Registrar amostra (RT e Cozinha)
router.post('/samples', requireRole('rt', 'cozinha'), wrap(async (req, res) => {
  const { prep, time } = req.body || {};
  if (!prep || !time) return res.status(400).json({ error: 'Campos obrigatorios: prep, time' });
  const date = new Date().toLocaleDateString('pt-BR');
  const r = await single(sb.from('samples').insert({ date, prep, time }).select());
  res.status(201).json(r);
}));

export default router;
