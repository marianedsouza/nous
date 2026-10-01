import { Router } from 'express';
import { sb, many, maybe, single, must } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../lib.js';

const router = Router();
router.use(requireAuth);

router.get('/', wrap(async (req, res) => {
  const rows = (await many(sb.from('employees').select('*').order('name')))
    .map((e) => ({ ...e, course: !!e.course, health: !!e.health }));
  res.json(rows);
}));

// Cadastro (RT e Gestor podem gerenciar pessoas)
router.post('/', requireRole('rt', 'gestor'), wrap(async (req, res) => {
  const { name, job, admission } = req.body || {};
  if (!name || !job) return res.status(400).json({ error: 'Informe nome e funcao' });
  const r = await single(sb.from('employees').insert({
    name, job, admission: admission || null, course: false, course_expiry: null, health: false, health_expiry: null,
  }).select());
  res.status(201).json({ ...r, course: !!r.course, health: !!r.health });
}));

// Alterna curso/carteira e permite atualizar validades (RT e Gestor)
router.patch('/:id', requireRole('rt', 'gestor'), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const e = await maybe(sb.from('employees').select('*').eq('id', id));
  if (!e) return res.status(404).json({ error: 'Funcionario nao encontrado' });
  const b = req.body || {};
  const patch = {
    course: b.course != null ? !!b.course : e.course,
    health: b.health != null ? !!b.health : e.health,
    course_expiry: b.course_expiry !== undefined ? b.course_expiry : e.course_expiry,
    health_expiry: b.health_expiry !== undefined ? b.health_expiry : e.health_expiry,
  };
  const r = await single(sb.from('employees').update(patch).eq('id', id).select());
  res.json({ ...r, course: !!r.course, health: !!r.health });
}));

router.delete('/:id', requireRole('rt', 'gestor'), wrap(async (req, res) => {
  must(await sb.from('employees').delete().eq('id', Number(req.params.id)));
  res.json({ ok: true });
}));

export default router;
