import { Router } from 'express';
import { sb, many, maybe, must } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap, resultFor, TODAY } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Lista dados gerenciais diarios
router.get('/', wrap(async (req, res) => {
  res.json(await many(sb.from('daily').select('*').order('date')));
}));

// Resumo do dia de hoje (KPIs do gestor)
router.get('/today', wrap(async (req, res) => {
  const today = (await maybe(sb.from('daily').select('*').eq('date', TODAY)))
    || { date: TODAY, clients: 0, price: 39.9, other_revenue: 0, food: null };
  res.json({ today, result: await resultFor(today) });
}));

// Cria/atualiza dados do dia (Gestor e RT).
// Nao envia 'food': em insert fica NULL (calculado dinamicamente p/ hoje); em update e preservado.
router.post('/', requireRole('gestor', 'rt'), wrap(async (req, res) => {
  const { date, clients, price, otherRevenue } = req.body || {};
  if (!date || clients == null || price == null) {
    return res.status(400).json({ error: 'Campos obrigatorios: date, clients, price' });
  }
  must(await sb.from('daily').upsert(
    { date, clients: Number(clients), price: Number(price), other_revenue: Number(otherRevenue || 0) },
    { onConflict: 'date' }
  ));
  const row = await maybe(sb.from('daily').select('*').eq('date', date));
  res.status(201).json({ ...row, result: await resultFor(row) });
}));

export default router;
