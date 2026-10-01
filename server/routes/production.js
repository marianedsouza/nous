import { Router } from 'express';
import { sb, many, must } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap, menuByDate, TODAY } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Producao do dia: itens do cardapio + ficha + qtd registrada
router.get('/:date?', wrap(async (req, res) => {
  const date = req.params.date || TODAY;
  const menu = await menuByDate(date);
  if (!menu || menu.items.length === 0) return res.json({ date, items: [], published: menu?.published });

  // Busca fichas e producao em LOTE (2 chamadas) em vez de N+1.
  const [sheets, prod] = await Promise.all([
    many(sb.from('sheets').select('id,prep,yield').in('prep', menu.items)),
    many(sb.from('production').select('prep,qty').eq('date', date).in('prep', menu.items)),
  ]);
  const sheetByPrep = new Map(sheets.map((s) => [s.prep.toLowerCase(), s]));
  const qtyByPrep = new Map(prod.map((p) => [p.prep.toLowerCase(), Number(p.qty)]));

  const items = menu.items.map((prep) => {
    const s = sheetByPrep.get(prep.toLowerCase());
    return {
      prep,
      sheetId: s ? s.id : null,
      yield: s ? s.yield : null,
      hasSheet: !!s,
      qty: qtyByPrep.get(prep.toLowerCase()) || 0,
    };
  });
  res.json({ date, published: menu.published, items });
}));

// Define quantidade de receitas/lotes de uma preparacao (RT e Cozinha)
router.put('/:date/:prep', requireRole('rt', 'cozinha'), wrap(async (req, res) => {
  const { date, prep } = req.params;
  const qty = Number(req.body?.qty || 0);
  must(await sb.from('production').upsert({ date, prep, qty }, { onConflict: 'date,prep' }));
  res.json({ ok: true, date, prep, qty });
}));

export default router;
