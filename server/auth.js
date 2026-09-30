import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret';
const COOKIE_NAME = 'nous_token';
const MAX_AGE = 1000 * 60 * 60 * 8; // 8h

if (!process.env.JWT_SECRET) {
  console.warn('[auth] AVISO: JWT_SECRET nao definido no .env. Usando segredo inseguro de desenvolvimento.');
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

export function verifyCredentials(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase().trim());
  if (!user) return null;
  if (!bcrypt.compareSync(password || '', user.password_hash)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/**
 * Middleware: exige usuario autenticado. Popula req.user.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || bearer(req);
  if (!token) return res.status(401).json({ error: 'Nao autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    next();
  } catch {
    return res.status(401).json({ error: 'Sessao invalida ou expirada' });
  }
}

/**
 * Middleware factory: exige um dos papeis informados.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Nao autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado para o seu perfil' });
    }
    next();
  };
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export { COOKIE_NAME };
