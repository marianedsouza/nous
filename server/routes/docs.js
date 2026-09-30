import { Router } from 'express';
import multer from 'multer';
import { q, q1, exec } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../lib.js';

const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

// Serverless-friendly: arquivo em memoria, depois gravado como bytea no Postgres.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo nao permitido (use PDF, PNG, JPG ou WEBP)'));
  },
});

const router = Router();
router.use(requireAuth);

// Cozinha so enxerga POPs. Nunca retorna a coluna binaria na listagem.
async function visibleFor(role) {
  if (role === 'cozinha') {
    return q("SELECT id,type,expiry,filename,mime,size,(data IS NOT NULL) AS has_file FROM docs WHERE type = 'POP' ORDER BY created_at DESC");
  }
  return q('SELECT id,type,expiry,filename,mime,size,(data IS NOT NULL) AS has_file FROM docs ORDER BY created_at DESC');
}

router.get('/', wrap(async (req, res) => {
  const rows = (await visibleFor(req.user.role)).map((d) => ({
    id: d.id, type: d.type, expiry: d.expiry, filename: d.filename,
    hasFile: !!d.has_file, size: d.size, mime: d.mime,
  }));
  res.json(rows);
}));

// Download / visualizacao do arquivo
router.get('/:id/file', wrap(async (req, res) => {
  const d = await q1('SELECT * FROM docs WHERE id = $1', [Number(req.params.id)]);
  if (!d) return res.status(404).json({ error: 'Documento nao encontrado' });
  if (req.user.role === 'cozinha' && d.type !== 'POP') return res.status(403).json({ error: 'Acesso negado' });
  if (!d.data) return res.status(404).json({ error: 'Documento demonstrativo sem arquivo anexado' });
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(d.filename || 'documento')}"`);
  res.setHeader('Content-Type', d.mime || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(d.data); // bytea vem como Buffer
}));

// Upload (RT)
router.post('/', requireRole('rt'), upload.single('file'), wrap(async (req, res) => {
  const { type, expiry } = req.body || {};
  if (!type) return res.status(400).json({ error: 'Informe o tipo do documento' });
  const f = req.file;
  const r = await q1(
    `INSERT INTO docs (type, expiry, filename, mime, size, data)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id,type,expiry,filename,mime,size,(data IS NOT NULL) AS has_file`,
    [type, expiry || null, f ? f.originalname : null, f ? f.mimetype : null, f ? f.size : null, f ? f.buffer : null]
  );
  res.status(201).json(r);
}));

// Exclui (RT)
router.delete('/:id', requireRole('rt'), wrap(async (req, res) => {
  await exec('DELETE FROM docs WHERE id = $1', [Number(req.params.id)]);
  res.json({ ok: true });
}));

export default router;
