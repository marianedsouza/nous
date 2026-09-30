import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap, resultFor, TODAY } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Lista dados gerenciais diarios
router.get('/', wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM daily ORDER BY date').all();
  res.json(rows);
}));

// Resumo do dia de hoje (KPIs do gestor)
router.get('/today', wrap((req, res) => {
  const today = db.prepare('SELECT * FROM daily WHERE date = ?').get(TODAY)
    || { date: TODAY, clients: 0, price: 39.9, other_revenue: 0, food: null };
  res.json({ today, result: resultFor(today) });
}));

// Cria/atualiza dados do dia (Gestor e RT). food fica null -> calculado dinamicamente para hoje.
router.post('/', requireRole('gestor', 'rt'), wrap((req, res) => {
  const { date, clients, price, otherRevenue } = req.body || {};
  if (!date || clients == null || price == null) {
    return res.status(400).json({ error: 'Campos obrigatorios: date, clients, price' });
  }
  const existing = db.prepare('SELECT * FROM daily WHERE date = ?').get(date);
  if (existing) {
    db.prepare('UPDATE daily SET clients=?,price=?,other_revenue=? WHERE date=?')
      .run(Number(clients), Number(price), Number(otherRevenue || 0), date);
  } else {
    db.prepare('INSERT INTO daily (date,clients,price,other_revenue,food) VALUES (?,?,?,?,NULL)')
      .run(date, Number(clients), Number(price), Number(otherRevenue || 0));
  }
  const row = db.prepare('SELECT * FROM daily WHERE date = ?').get(date);
  res.status(201).json({ ...row, result: resultFor(row) });
}));

export default router;
