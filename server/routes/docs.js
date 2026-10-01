import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { sb, DOCS_BUCKET, many, maybe, single, must } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { wrap } from '../lib.js';

const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

// Arquivo em memoria; depois enviado para o Supabase Storage.
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

const shape = (d) => ({
  id: d.id, type: d.type, expiry: d.expiry, filename: d.filename,
  hasFile: !!d.stored_name, size: d.size, mime: d.mime,
});

router.get('/', wrap(async (req, res) => {
  let query = sb.from('docs').select('id,type,expiry,filename,stored_name,mime,size').order('created_at', { ascending: false });
  if (req.user.role === 'cozinha') query = query.eq('type', 'POP');
  const rows = await many(query);
  res.json(rows.map(shape));
}));

// Download / visualizacao do arquivo (baixado do Storage server-side)
router.get('/:id/file', wrap(async (req, res) => {
  const d = await maybe(sb.from('docs').select('*').eq('id', Number(req.params.id)));
  if (!d) return res.status(404).json({ error: 'Documento nao encontrado' });
  if (req.user.role === 'cozinha' && d.type !== 'POP') return res.status(403).json({ error: 'Acesso negado' });
  if (!d.stored_name) return res.status(404).json({ error: 'Documento demonstrativo sem arquivo anexado' });

  const { data, error } = await sb.storage.from(DOCS_BUCKET).download(d.stored_name);
  if (error || !data) return res.status(404).json({ error: 'Arquivo ausente no storage' });
  const buf = Buffer.from(await data.arrayBuffer());

  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(d.filename || 'documento')}"`);
  res.setHeader('Content-Type', d.mime || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buf);
}));

// Upload (RT) -> Storage + metadados no banco
router.post('/', requireRole('rt'), upload.single('file'), wrap(async (req, res) => {
  const { type, expiry } = req.body || {};
  if (!type) return res.status(400).json({ error: 'Informe o tipo do documento' });

  const f = req.file;
  let storedName = null;
  if (f) {
    const ext = path.extname(f.originalname).slice(0, 10);
    storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const up = await sb.storage.from(DOCS_BUCKET).upload(storedName, f.buffer, {
      contentType: f.mimetype, upsert: false,
    });
    if (up.error) { const e = new Error('Falha ao enviar ao storage: ' + up.error.message); e.status = 500; throw e; }
  }

  const row = await single(sb.from('docs').insert({
    type,
    expiry: expiry || null,
    filename: f ? f.originalname : null,
    stored_name: storedName,
    mime: f ? f.mimetype : null,
    size: f ? f.size : null,
  }).select());
  res.status(201).json(shape(row));
}));

// Exclui (RT) -> remove do Storage e do banco
router.delete('/:id', requireRole('rt'), wrap(async (req, res) => {
  const d = await maybe(sb.from('docs').select('*').eq('id', Number(req.params.id)));
  if (d?.stored_name) {
    await sb.storage.from(DOCS_BUCKET).remove([d.stored_name]);
  }
  must(await sb.from('docs').delete().eq('id', Number(req.params.id)));
  res.json({ ok: true });
}));

export default router;
