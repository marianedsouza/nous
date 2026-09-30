import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo nao permitido (use PDF, PNG, JPG ou WEBP)'));
  },
});

const router = Router();
router.use(requireAuth);

// Cozinha so enxerga POPs
function visibleFor(role) {
  if (role === 'cozinha') return db.prepare("SELECT * FROM docs WHERE type = 'POP' ORDER BY created_at DESC").all();
  return db.prepare('SELECT * FROM docs ORDER BY created_at DESC').all();
}

router.get('/', wrap((req, res) => {
  const rows = visibleFor(req.user.role).map(d => ({
    id: d.id, type: d.type, expiry: d.expiry, filename: d.filename,
    hasFile: !!d.stored_name, size: d.size, mime: d.mime,
  }));
  res.json(rows);
}));

// Download / visualizacao do arquivo
router.get('/:id/file', wrap((req, res) => {
  const d = db.prepare('SELECT * FROM docs WHERE id = ?').get(Number(req.params.id));
  if (!d) return res.status(404).json({ error: 'Documento nao encontrado' });
  if (req.user.role === 'cozinha' && d.type !== 'POP') return res.status(403).json({ error: 'Acesso negado' });
  if (!d.stored_name) return res.status(404).json({ error: 'Documento demonstrativo sem arquivo anexado' });
  const full = path.join(UPLOAD_DIR, d.stored_name);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Arquivo ausente no servidor' });
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(d.filename || 'documento')}"`);
  if (d.mime) res.setHeader('Content-Type', d.mime);
  fs.createReadStream(full).pipe(res);
}));

// Upload (RT)
router.post('/', requireRole('rt'), upload.single('file'), wrap((req, res) => {
  const { type, expiry } = req.body || {};
  if (!type) return res.status(400).json({ error: 'Informe o tipo do documento' });
  const f = req.file;
  const r = db.prepare('INSERT INTO docs (type,expiry,filename,stored_name,mime,size) VALUES (?,?,?,?,?,?)')
    .run(type, expiry || null, f ? f.originalname : null, f ? f.filename : null, f ? f.mimetype : null, f ? f.size : null);
  res.status(201).json(db.prepare('SELECT * FROM docs WHERE id = ?').get(Number(r.lastInsertRowid)));
}));

// Exclui (RT) - remove arquivo do disco tambem
router.delete('/:id', requireRole('rt'), wrap((req, res) => {
  const d = db.prepare('SELECT * FROM docs WHERE id = ?').get(Number(req.params.id));
  if (d?.stored_name) {
    const full = path.join(UPLOAD_DIR, d.stored_name);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }
  db.prepare('DELETE FROM docs WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
}));

export default router;
