import { Router } from 'express';
import { q, q1, exec } from '../db.js';
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

router.get('/', wrap(async (req, res) => {
  const rows = await q('SELECT * FROM sheets ORDER BY prep');
  res.json(rows.map((s) => stripFinancial(s, req.user.role)));
}));

router.get('/:id', wrap(async (req, res) => {
  const s = await q1('SELECT * FROM sheets WHERE id = $1', [Number(req.params.id)]);
  if (!s) return res.status(404).json({ error: 'Ficha nao encontrada' });
  res.json(stripFinancial(s, req.user.role));
}));

router.post('/', requireRole('rt'), wrap(async (req, res) => {
  const { prep, cat, ingredients, yield: yld, cost, method, rev, obs } = req.body || {};
  if (!prep || !ingredients || !yld || !method) {
    return res.status(400).json({ error: 'Campos obrigatorios: prep, ingredients, yield, method' });
  }
  const r = await q1(
    `INSERT INTO sheets (prep, cat, ingredients, yield, cost, method, rev, obs)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [prep, cat || null, ingredients, yld, Number(cost || 0), method, rev || null, obs || null]
  );
  res.status(201).json(r);
}));

router.put('/:id', requireRole('rt'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await q1('SELECT * FROM sheets WHERE id = $1', [id]);
  if (!existing) return res.status(404).json({ error: 'Ficha nao encontrada' });
  const { prep, cat, ingredients, yield: yld, cost, method, rev, obs } = { ...existing, ...req.body };
  const r = await q1(
    `UPDATE sheets SET prep=$1, cat=$2, ingredients=$3, yield=$4, cost=$5, method=$6, rev=$7, obs=$8
     WHERE id=$9 RETURNING *`,
    [prep, cat, ingredients, yld, Number(cost || 0), method, rev, obs, id]
  );
  res.json(r);
}));

router.delete('/:id', requireRole('rt'), wrap(async (req, res) => {
  await exec('DELETE FROM sheets WHERE id = $1', [Number(req.params.id)]);
  res.json({ ok: true });
}));

export default router;
