import pg from 'pg';

const { Pool, types } = pg;

// --- Ajuste dos parsers de tipo do pg para casar com o que o app espera ---
// bigint (int8, OID 20) -> number (ids cabem com folga em Number)
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
// numeric (OID 1700) -> float (custos, precos)
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
// date (OID 1082) -> string 'YYYY-MM-DD' (sem virar objeto Date)
types.setTypeParser(1082, (v) => v);

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[db] SUPABASE_DB_URL nao definido. Configure a connection string do Postgres do Supabase no .env.');
}

// Supabase exige TLS. Pool pequeno por causa do ambiente serverless.
export const pool = new Pool({
  connectionString,
  ssl: connectionString && !/localhost|127\.0\.0\.1/.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
  max: Number(process.env.PG_POOL_MAX || 3),
  idleTimeoutMillis: 10_000,
});

pool.on('error', (err) => console.error('[db] erro no pool:', err.message));

/** Retorna todas as linhas. */
export async function q(text, params = []) {
  const r = await pool.query(text, params);
  return r.rows;
}

/** Retorna a primeira linha ou null. */
export async function q1(text, params = []) {
  const r = await pool.query(text, params);
  return r.rows[0] || null;
}

/** Executa e retorna o result cru (rowCount, rows com RETURNING, etc.). */
export async function exec(text, params = []) {
  return pool.query(text, params);
}

/** Executa uma funcao dentro de uma transacao, com um client dedicado. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
