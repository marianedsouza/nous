import { Router } from 'express';
import { sb, many, must } from '../db.js';
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
  const v = (k) => (b[k] != null ? Number(b[k]) : cur[k]);
  must(await sb.from('fixed_costs').update({
    labor: v('labor'), rent: v('rent'), utilities: v('utilities'),
    taxes: v('taxes'), other: v('other'), days: v('days'),
  }).eq('id', 1));
  res.json(await fixedCosts());
}));

// Resultado diario calculado no servidor
router.get('/results', wrap(async (req, res) => {
  const days = await many(sb.from('daily').select('*').order('date'));
  const rows = [];
  for (const d of days) {
    rows.push({ date: d.date, clients: d.clients, price: d.price, other_revenue: d.other_revenue, ...(await resultFor(d)) });
  }
  res.json(rows);
}));

export default router;
