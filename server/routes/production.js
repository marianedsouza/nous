import { Router } from 'express';
import { exec } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap, menuByDate, sheetByPrep, prodQty, TODAY } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Producao do dia: itens do cardapio + ficha + qtd registrada
router.get('/:date?', wrap(async (req, res) => {
  const date = req.params.date || TODAY;
  const menu = await menuByDate(date);
  if (!menu) return res.json({ date, items: [] });
  const items = [];
  for (const prep of menu.items) {
    const s = await sheetByPrep(prep);
    items.push({
      prep,
      sheetId: s ? s.id : null,
      yield: s ? s.yield : null,
      hasSheet: !!s,
      qty: await prodQty(date, prep),
    });
  }
  res.json({ date, published: menu.published, items });
}));

// Define quantidade de receitas/lotes de uma preparacao (RT e Cozinha)
router.put('/:date/:prep', requireRole('rt', 'cozinha'), wrap(async (req, res) => {
  const { date, prep } = req.params;
  const qty = Number(req.body?.qty || 0);
  await exec(
    `INSERT INTO production (date, prep, qty) VALUES ($1, $2, $3)
     ON CONFLICT (date, prep) DO UPDATE SET qty = EXCLUDED.qty`,
    [date, prep, qty]
  );
  res.json({ ok: true, date, prep, qty });
}));

export default router;
