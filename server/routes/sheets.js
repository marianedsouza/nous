import { Router } from 'express';
import { sb, many, maybe, single, must } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Cozinha nao ve o custo financeiro
function stripFinancial(sheet, role) {
  if (!sheet) return sheet;
  if (role === 'cozinha') {
    const { cost, ...rest } = sheet;
    return { ...rest, cost: null };
  }
  return sheet;
}

router.get('/', wrap(async (req, res) => {
  const rows = await many(sb.from('sheets').select('*').order('prep'));
  res.json(rows.map((s) => stripFinancial(s, req.user.role)));
}));

router.get('/:id', wrap(async (req, res) => {
  const s = await maybe(sb.from('sheets').select('*').eq('id', Number(req.params.id)));
  if (!s) return res.status(404).json({ error: 'Ficha nao encontrada' });
  res.json(stripFinancial(s, req.user.role));
}));

router.post('/', requireRole('rt'), wrap(async (req, res) => {
  const { prep, cat, ingredients, yield: yld, cost, method, rev, obs } = req.body || {};
  if (!prep || !ingredients || !yld || !method) {
    return res.status(400).json({ error: 'Campos obrigatorios: prep, ingredients, yield, method' });
  }
  const row = await single(sb.from('sheets').insert({
    prep, cat: cat || null, ingredients, yield: yld, cost: Number(cost || 0), method, rev: rev || null, obs: obs || null,
  }).select());
  res.status(201).json(row);
}));

router.put('/:id', requireRole('rt'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await maybe(sb.from('sheets').select('*').eq('id', id));
  if (!existing) return res.status(404).json({ error: 'Ficha nao encontrada' });
  const b = req.body || {};
  const patch = {
    prep: b.prep ?? existing.prep,
    cat: b.cat ?? existing.cat,
    ingredients: b.ingredients ?? existing.ingredients,
    yield: b.yield ?? existing.yield,
    cost: b.cost != null ? Number(b.cost) : existing.cost,
    method: b.method ?? existing.method,
    rev: b.rev ?? existing.rev,
    obs: b.obs ?? existing.obs,
  };
  const row = await single(sb.from('sheets').update(patch).eq('id', id).select());
  res.json(row);
}));

router.delete('/:id', requireRole('rt'), wrap(async (req, res) => {
  must(await sb.from('sheets').delete().eq('id', Number(req.params.id)));
  res.json({ ok: true });
}));

export default router;
