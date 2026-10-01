import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn('[db] Configure SUPABASE_URL e SUPABASE_SECRET_KEY no .env. O backend usa a secret key (service role).');
}

// Cliente com a secret key: ignora RLS (acesso total server-side).
export const sb = createClient(url || 'http://localhost', key || 'missing', {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET || 'docs';

/** Desembrulha { data, error } do supabase-js, lançando em caso de erro. */
export function must({ data, error }) {
  if (error) {
    const e = new Error(error.message || 'Erro no Supabase');
    e.status = error.code === 'PGRST116' ? 404 : 500;
    e.cause = error;
    throw e;
  }
  return data;
}

/** SELECT que retorna várias linhas. Recebe uma query já montada. */
export async function many(query) {
  return must(await query);
}

/** SELECT de uma linha (ou null). Aplica .maybeSingle() se ainda não aplicado. */
export async function maybe(query) {
  return must(await query.maybeSingle());
}

/** INSERT/UPDATE que retorna exatamente uma linha. */
export async function single(query) {
  return must(await query.single());
}

/** COUNT exato (head request). Recebe uma query com { count:'exact', head:true }. */
export async function countOf(query) {
  const { count, error } = await query;
  if (error) { const e = new Error(error.message); e.status = 500; throw e; }
  return count || 0;
}
