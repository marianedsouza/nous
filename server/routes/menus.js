import { Router } from 'express';
import { q, exec, tx } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap, menuByDate } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Lista todos os dias do cardapio (com itens)
router.get('/', wrap(async (req, res) => {
  const menus = await q('SELECT * FROM menus ORDER BY date');
  const withItems = [];
  for (const m of menus) {
    const items = await q('SELECT name FROM menu_items WHERE menu_id = $1 ORDER BY position', [m.id]);
    withItems.push({ id: m.id, date: m.date, published: !!m.published, items: items.map((i) => i.name) });
  }
  const published = withItems.length > 0 && withItems.every((m) => m.published);
  res.json({ menus: withItems, published });
}));

// Cardapio de uma data especifica
router.get('/date/:date', wrap(async (req, res) => {
  const menu = await menuByDate(req.params.date);
  if (!menu) return res.status(404).json({ error: 'Sem cardapio para a data' });
  res.json(menu);
}));

// Adiciona/atualiza um dia (RT). Ao alterar, o mes volta a rascunho.
router.post('/', requireRole('rt'), wrap(async (req, res) => {
  const { date, items } = req.body || {};
  if (!date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Informe data e ao menos uma preparacao' });
  }
  const clean = items.map((x) => String(x).trim()).filter(Boolean);
  await tx(async (client) => {
    const existing = await client.query('SELECT id FROM menus WHERE date = $1', [date]);
    let menuId;
    if (existing.rows[0]) {
      menuId = existing.rows[0].id;
      await client.query('DELETE FROM menu_items WHERE menu_id = $1', [menuId]);
    } else {
      const ins = await client.query('INSERT INTO menus (date, published) VALUES ($1, false) RETURNING id', [date]);
      menuId = ins.rows[0].id;
    }
    for (let i = 0; i < clean.length; i++) {
      await client.query('INSERT INTO menu_items (menu_id, name, position) VALUES ($1, $2, $3)', [menuId, clean[i], i]);
    }
    // Adicionar/alterar dia derruba a publicacao do mes
    await client.query('UPDATE menus SET published = false');
  });
  res.status(201).json(await menuByDate(date));
}));

// Publica o mes inteiro (RT)
router.post('/publish', requireRole('rt'), wrap(async (req, res) => {
  await exec('UPDATE menus SET published = true');
  res.json({ ok: true, published: true });
}));

// Exclui um dia (RT)
router.delete('/:id', requireRole('rt'), wrap(async (req, res) => {
  await exec('DELETE FROM menus WHERE id = $1', [Number(req.params.id)]);
  res.json({ ok: true });
}));

export default router;
