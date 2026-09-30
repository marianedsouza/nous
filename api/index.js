// Entrypoint serverless do Vercel. Reaproveita o mesmo app Express.
import app from '../server/app.js';

export default function handler(req, res) {
  return app(req, res);
}
