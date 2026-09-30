import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../lib.js';

const router = Router();
router.use(requireAuth);

// Historico recente (temperaturas + amostras)
router.get('/', wrap((req, res) => {
  const temps = db.prepare('SELECT * FROM temps ORDER BY id DESC LIMIT 50').all();
  const samples = db.prepare('SELECT * FROM samples ORDER BY id DESC LIMIT 50').all();
  const attention = db.prepare("SELECT COUNT(*) AS c FROM temps WHERE status != 'Conforme'").get().c;
  res.json({ temps, samples, attention });
}));

// Registrar temperatura (RT e Cozinha)
router.post('/temps', requireRole('rt', 'cozinha'), wrap((req, res) => {
  const { type, place, value, status } = req.body || {};
  if (!type || !place || value == null || !status) {
    return res.status(400).json({ error: 'Campos obrigatorios: type, place, value, status' });
  }
  const dt = new Date().toLocaleString('pt-BR');
  const r = db.prepare('INSERT INTO temps (dt,type,place,value,status) VALUES (?,?,?,?,?)')
    .run(dt, type, place, Number(value), status);
  res.status(201).json(db.prepare('SELECT * FROM temps WHERE id = ?').get(Number(r.lastInsertRowid)));
}));

// Registrar amostra (RT e Cozinha)
router.post('/samples', requireRole('rt', 'cozinha'), wrap((req, res) => {
  const { prep, time } = req.body || {};
  if (!prep || !time) return res.status(400).json({ error: 'Campos obrigatorios: prep, time' });
  const date = new Date().toLocaleDateString('pt-BR');
  const r = db.prepare('INSERT INTO samples (date,prep,time) VALUES (?,?,?)').run(date, prep, time);
  res.status(201).json(db.prepare('SELECT * FROM samples WHERE id = ?').get(Number(r.lastInsertRowid)));
}));

export default router;
