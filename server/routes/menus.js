import { Router } from 'express';
import { sb, many, maybe, must } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap, menuByDate } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Lista todos os dias do cardapio (com itens)
router.get('/', wrap(async (req, res) => {
  // Uma unica chamada com join embutido (evita N+1).
  const menus = await many(sb.from('menus').select('*, menu_items(name, position)').order('date'));
  const withItems = menus.map((m) => ({
    id: m.id,
    date: m.date,
    published: !!m.published,
    items: (m.menu_items || []).sort((a, b) => a.position - b.position).map((i) => i.name),
  }));
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
// Sem transacao real no SDK: operacoes sequenciais (best-effort).
router.post('/', requireRole('rt'), wrap(async (req, res) => {
  const { date, items } = req.body || {};
  if (!date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Informe data e ao menos uma preparacao' });
  }
  const clean = items.map((x) => String(x).trim()).filter(Boolean);

  let menu = await maybe(sb.from('menus').select('id').eq('date', date));
  let menuId;
  if (menu) {
    menuId = menu.id;
    must(await sb.from('menu_items').delete().eq('menu_id', menuId));
  } else {
    const created = must(await sb.from('menus').insert({ date, published: false }).select('id').single());
    menuId = created.id;
  }
  const rows = clean.map((name, i) => ({ menu_id: menuId, name, position: i }));
  must(await sb.from('menu_items').insert(rows));
  // Adicionar/alterar dia derruba a publicacao do mes
  must(await sb.from('menus').update({ published: false }).gt('id', 0));

  res.status(201).json(await menuByDate(date));
}));

// Publica o mes inteiro (RT)
router.post('/publish', requireRole('rt'), wrap(async (req, res) => {
  must(await sb.from('menus').update({ published: true }).gt('id', 0));
  res.json({ ok: true, published: true });
}));

// Exclui um dia (RT)
router.delete('/:id', requireRole('rt'), wrap(async (req, res) => {
  must(await sb.from('menus').delete().eq('id', Number(req.params.id)));
  res.json({ ok: true });
}));

export default router;
