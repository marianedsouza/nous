import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap, menuByDate } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Lista todos os dias do cardapio (com itens)
router.get('/', wrap((req, res) => {
  const menus = db.prepare('SELECT * FROM menus ORDER BY date').all();
  const withItems = menus.map(m => ({
    id: m.id,
    date: m.date,
    published: !!m.published,
    items: db.prepare('SELECT name FROM menu_items WHERE menu_id = ? ORDER BY position').all(m.id).map(i => i.name),
  }));
  const published = withItems.length > 0 && withItems.every(m => m.published);
  res.json({ menus: withItems, published });
}));

// Cardapio de uma data especifica
router.get('/date/:date', wrap((req, res) => {
  const menu = menuByDate(req.params.date);
  if (!menu) return res.status(404).json({ error: 'Sem cardapio para a data' });
  res.json(menu);
}));

// Adiciona/atualiza um dia (RT). Ao alterar, o mes volta a rascunho.
router.post('/', requireRole('rt'), wrap((req, res) => {
  const { date, items } = req.body || {};
  if (!date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Informe data e ao menos uma preparacao' });
  }
  const clean = items.map(x => String(x).trim()).filter(Boolean);
  const tx = () => {
    let menu = db.prepare('SELECT * FROM menus WHERE date = ?').get(date);
    let menuId;
    if (menu) {
      menuId = menu.id;
      db.prepare('DELETE FROM menu_items WHERE menu_id = ?').run(menuId);
    } else {
      menuId = Number(db.prepare('INSERT INTO menus (date,published) VALUES (?,0)').run(date).lastInsertRowid);
    }
    const ins = db.prepare('INSERT INTO menu_items (menu_id,name,position) VALUES (?,?,?)');
    clean.forEach((it, i) => ins.run(menuId, it, i));
    // Adicionar/alterar dia derruba a publicacao do mes
    db.prepare('UPDATE menus SET published = 0').run();
  };
  db.exec('BEGIN'); try { tx(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  res.status(201).json(menuByDate(date));
}));

// Publica o mes inteiro (RT)
router.post('/publish', requireRole('rt'), wrap((req, res) => {
  db.prepare('UPDATE menus SET published = 1').run();
  res.json({ ok: true, published: true });
}));

// Exclui um dia (RT)
router.delete('/:id', requireRole('rt'), wrap((req, res) => {
  db.prepare('DELETE FROM menus WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
}));

export default router;
