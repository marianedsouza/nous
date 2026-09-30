import { Router } from 'express';
import { q, q1, exec } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap, resultFor, TODAY } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Lista dados gerenciais diarios
router.get('/', wrap(async (req, res) => {
  res.json(await q('SELECT * FROM daily ORDER BY date'));
}));

// Resumo do dia de hoje (KPIs do gestor)
router.get('/today', wrap(async (req, res) => {
  const today = (await q1('SELECT * FROM daily WHERE date = $1', [TODAY]))
    || { date: TODAY, clients: 0, price: 39.9, other_revenue: 0, food: null };
  res.json({ today, result: await resultFor(today) });
}));

// Cria/atualiza dados do dia (Gestor e RT). food fica null -> calculado dinamicamente para hoje.
router.post('/', requireRole('gestor', 'rt'), wrap(async (req, res) => {
  const { date, clients, price, otherRevenue } = req.body || {};
  if (!date || clients == null || price == null) {
    return res.status(400).json({ error: 'Campos obrigatorios: date, clients, price' });
  }
  await exec(
    `INSERT INTO daily (date, clients, price, other_revenue, food)
     VALUES ($1,$2,$3,$4,NULL)
     ON CONFLICT (date) DO UPDATE SET clients=EXCLUDED.clients, price=EXCLUDED.price, other_revenue=EXCLUDED.other_revenue`,
    [date, Number(clients), Number(price), Number(otherRevenue || 0)]
  );
  const row = await q1('SELECT * FROM daily WHERE date = $1', [date]);
  res.status(201).json({ ...row, result: await resultFor(row) });
}));

export default router;
