import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap, fixedCosts, resultFor } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Custos fixos atuais
router.get('/fixed', wrap((req, res) => {
  res.json(fixedCosts());
}));

// Atualiza custos fixos (RT)
router.put('/fixed', requireRole('rt'), wrap((req, res) => {
  const b = req.body || {};
  const cur = fixedCosts();
  const v = (k, d) => (b[k] != null ? Number(b[k]) : d);
  db.prepare('UPDATE fixed_costs SET labor=?,rent=?,utilities=?,taxes=?,other=?,days=? WHERE id=1')
    .run(v('labor', cur.labor), v('rent', cur.rent), v('utilities', cur.utilities),
      v('taxes', cur.taxes), v('other', cur.other), v('days', cur.days));
  res.json(fixedCosts());
}));

// Resultado diario calculado no servidor
router.get('/results', wrap((req, res) => {
  const days = db.prepare('SELECT * FROM daily ORDER BY date').all();
  const rows = days.map(d => ({
    date: d.date,
    clients: d.clients,
    price: d.price,
    other_revenue: d.other_revenue,
    ...resultFor(d),
  }));
  res.json(rows);
}));

export default router;
