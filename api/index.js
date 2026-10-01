// Entrypoint serverless do Vercel: SOMENTE a API.
// Os arquivos estaticos (public/) sao servidos pelo CDN da Vercel, nao por aqui.
import app from '../server/api.js';

export default function handler(req, res) {
  return app(req, res);
}
