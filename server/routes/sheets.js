import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Cozinha nao ve o custo financeiro
function stripFinancial(sheet, role) {
  if (role === 'cozinha') {
    const { cost, ...rest } = sheet;
    return { ...rest, cost: null };
  }
  return sheet;
}

router.get('/', wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM sheets ORDER BY prep').all();
  res.json(rows.map(s => stripFinancial(s, req.user.role)));
}));

router.get('/:id', wrap((req, res) => {
  const s = db.prepare('SELECT * FROM sheets WHERE id = ?').get(Number(req.params.id));
  if (!s) return res.status(404).json({ error: 'Ficha nao encontrada' });
  res.json(stripFinancial(s, req.user.role));
}));

router.post('/', requireRole('rt'), wrap((req, res) => {
  const { prep, cat, ingredients, yield: yld, cost, method, rev, obs } = req.body || {};
  if (!prep || !ingredients || !yld || !method) {
    return res.status(400).json({ error: 'Campos obrigatorios: prep, ingredients, yield, method' });
  }
  const r = db.prepare('INSERT INTO sheets (prep,cat,ingredients,yield,cost,method,rev,obs) VALUES (?,?,?,?,?,?,?,?)')
    .run(prep, cat || null, ingredients, yld, Number(cost || 0), method, rev || null, obs || null);
  res.status(201).json(db.prepare('SELECT * FROM sheets WHERE id = ?').get(Number(r.lastInsertRowid)));
}));

router.put('/:id', requireRole('rt'), wrap((req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM sheets WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Ficha nao encontrada' });
  const { prep, cat, ingredients, yield: yld, cost, method, rev, obs } = { ...existing, ...req.body };
  db.prepare('UPDATE sheets SET prep=?,cat=?,ingredients=?,yield=?,cost=?,method=?,rev=?,obs=? WHERE id=?')
    .run(prep, cat, ingredients, yld, Number(cost || 0), method, rev, obs, id);
  res.json(db.prepare('SELECT * FROM sheets WHERE id = ?').get(id));
}));

router.delete('/:id', requireRole('rt'), wrap((req, res) => {
  db.prepare('DELETE FROM sheets WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
}));

export default router;
