import { Router } from 'express';
import { q, q1, exec } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../lib.js';

const router = Router();
router.use(requireAuth);

router.get('/', wrap(async (req, res) => {
  const rows = (await q('SELECT * FROM employees ORDER BY name'))
    .map((e) => ({ ...e, course: !!e.course, health: !!e.health }));
  res.json(rows);
}));

// Cadastro (RT e Gestor podem gerenciar pessoas)
router.post('/', requireRole('rt', 'gestor'), wrap(async (req, res) => {
  const { name, job, admission } = req.body || {};
  if (!name || !job) return res.status(400).json({ error: 'Informe nome e funcao' });
  const r = await q1(
    `INSERT INTO employees (name, job, admission, course, course_expiry, health, health_expiry)
     VALUES ($1,$2,$3,false,NULL,false,NULL) RETURNING *`,
    [name, job, admission || null]
  );
  res.status(201).json({ ...r, course: !!r.course, health: !!r.health });
}));

// Alterna curso/carteira e permite atualizar validades (RT e Gestor)
router.patch('/:id', requireRole('rt', 'gestor'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const e = await q1('SELECT * FROM employees WHERE id = $1', [id]);
  if (!e) return res.status(404).json({ error: 'Funcionario nao encontrado' });
  const b = req.body || {};
  const course = b.course != null ? !!b.course : e.course;
  const health = b.health != null ? !!b.health : e.health;
  const courseExpiry = b.course_expiry !== undefined ? b.course_expiry : e.course_expiry;
  const healthExpiry = b.health_expiry !== undefined ? b.health_expiry : e.health_expiry;
  const r = await q1(
    `UPDATE employees SET course=$1, course_expiry=$2, health=$3, health_expiry=$4 WHERE id=$5 RETURNING *`,
    [course, courseExpiry, health, healthExpiry, id]
  );
  res.json({ ...r, course: !!r.course, health: !!r.health });
}));

router.delete('/:id', requireRole('rt', 'gestor'), wrap(async (req, res) => {
  await exec('DELETE FROM employees WHERE id = $1', [Number(req.params.id)]);
  res.json({ ok: true });
}));

export default router;
