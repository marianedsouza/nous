import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap, menuByDate, sheetByPrep, prodQty, TODAY } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Producao do dia: itens do cardapio + ficha + qtd registrada
router.get('/:date?', wrap((req, res) => {
  const date = req.params.date || TODAY;
  const menu = menuByDate(date);
  if (!menu) return res.json({ date, items: [] });
  const items = menu.items.map(prep => {
    const s = sheetByPrep(prep);
    return {
      prep,
      sheetId: s ? s.id : null,
      yield: s ? s.yield : null,
      hasSheet: !!s,
      qty: prodQty(date, prep),
    };
  });
  res.json({ date, published: menu.published, items });
}));

// Define quantidade de receitas/lotes de uma preparacao (RT e Cozinha)
router.put('/:date/:prep', requireRole('rt', 'cozinha'), wrap((req, res) => {
  const { date, prep } = req.params;
  const qty = Number(req.body?.qty || 0);
  db.prepare(`
    INSERT INTO production (date, prep, qty) VALUES (?,?,?)
    ON CONFLICT(date, prep) DO UPDATE SET qty = excluded.qty
  `).run(date, prep, qty);
  res.json({ ok: true, date, prep, qty });
}));

export default router;
