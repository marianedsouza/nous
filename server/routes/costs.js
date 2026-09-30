import { Router } from 'express';
import { q, exec } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap, fixedCosts, resultFor } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Custos fixos atuais
router.get('/fixed', wrap(async (req, res) => {
  res.json(await fixedCosts());
}));

// Atualiza custos fixos (RT)
router.put('/fixed', requireRole('rt'), wrap(async (req, res) => {
  const b = req.body || {};
  const cur = await fixedCosts();
  const v = (k, d) => (b[k] != null ? Number(b[k]) : d);
  await exec(
    `UPDATE fixed_costs SET labor=$1, rent=$2, utilities=$3, taxes=$4, other=$5, days=$6 WHERE id=1`,
    [v('labor', cur.labor), v('rent', cur.rent), v('utilities', cur.utilities), v('taxes', cur.taxes), v('other', cur.other), v('days', cur.days)]
  );
  res.json(await fixedCosts());
}));

// Resultado diario calculado no servidor
router.get('/results', wrap(async (req, res) => {
  const days = await q('SELECT * FROM daily ORDER BY date');
  const rows = [];
  for (const d of days) {
    rows.push({ date: d.date, clients: d.clients, price: d.price, other_revenue: d.other_revenue, ...(await resultFor(d)) });
  }
  res.json(rows);
}));

export default router;
