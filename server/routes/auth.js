import { Router } from 'express';
import { verifyCredentials, signToken, setAuthCookie, clearAuthCookie, requireAuth } from '../auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Informe email e senha' });
    const user = await verifyCredentials(email, password);
    if (!user) return res.status(401).json({ error: 'Credenciais invalidas' });
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
