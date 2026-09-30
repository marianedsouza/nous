import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../lib.js';

const router = Router();
router.use(requireAuth);

router.get('/', wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM employees ORDER BY name').all()
    .map(e => ({ ...e, course: !!e.course, health: !!e.health }));
  res.json(rows);
}));

// Cadastro (RT e Gestor podem gerenciar pessoas)
router.post('/', requireRole('rt', 'gestor'), wrap((req, res) => {
  const { name, job, admission } = req.body || {};
  if (!name || !job) return res.status(400).json({ error: 'Informe nome e funcao' });
  const r = db.prepare('INSERT INTO employees (name,job,admission,course,course_expiry,health,health_expiry) VALUES (?,?,?,0,?,0,?)')
    .run(name, job, admission || null, null, null);
  res.status(201).json(db.prepare('SELECT * FROM employees WHERE id = ?').get(Number(r.lastInsertRowid)));
}));

// Alterna curso/carteira e permite atualizar validades (RT e Gestor)
router.patch('/:id', requireRole('rt', 'gestor'), wrap((req, res) => {
  const id = Number(req.params.id);
  const e = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!e) return res.status(404).json({ error: 'Funcionario nao encontrado' });
  const b = req.body || {};
  const course = b.course != null ? (b.course ? 1 : 0) : e.course;
  const health = b.health != null ? (b.health ? 1 : 0) : e.health;
  const courseExpiry = b.course_expiry !== undefined ? b.course_expiry : e.course_expiry;
  const healthExpiry = b.health_expiry !== undefined ? b.health_expiry : e.health_expiry;
  db.prepare('UPDATE employees SET course=?,course_expiry=?,health=?,health_expiry=? WHERE id=?')
    .run(course, courseExpiry, health, healthExpiry, id);
  const out = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  res.json({ ...out, course: !!out.course, health: !!out.health });
}));

router.delete('/:id', requireRole('rt', 'gestor'), wrap((req, res) => {
  db.prepare('DELETE FROM employees WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
}));

export default router;
