// Verifica se as tabelas do NOUS existem no Supabase, via API REST (PostgREST).
// Usa a chave publishable (só leitura); não cria nada.
// Uso: node scripts/supabase-check.mjs

import 'dotenv/config';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error('[erro] Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env');
  process.exit(1);
}

const TABLES = ['users', 'settings', 'menus', 'menu_items', 'sheets', 'production', 'docs', 'employees', 'temps', 'samples', 'fixed_costs', 'daily'];

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function checkTable(t) {
  const url = `${URL}/rest/v1/${t}?select=*&limit=1`;
  try {
    const res = await fetch(url, { headers });
    let body = null;
    try { body = await res.json(); } catch { /* noop */ }
    const code = body && body.code;
    if (res.ok) return { t, ok: true, note: `existe (HTTP ${res.status})` };
    // Tabela ausente
    if (res.status === 404 || code === 'PGRST205') return { t, ok: false, note: 'NÃO existe (404)' };
    // Permissão/RLS negando: a tabela existe, mas o acesso anon está bloqueado
    if (res.status === 401 || res.status === 403 || code === '42501') return { t, ok: true, note: `existe (bloqueada por RLS/permite — HTTP ${res.status})` };
    return { t, ok: null, note: `resposta inesperada HTTP ${res.status} ${code || ''} ${body?.message || ''}`.trim() };
  } catch (e) {
    return { t, ok: null, note: 'erro de rede: ' + e.message };
  }
}

console.log(`Projeto: ${URL}\n`);
const results = await Promise.all(TABLES.map(checkTable));
let exist = 0, missing = 0, unknown = 0;
for (const r of results) {
  const mark = r.ok === true ? 'OK  ' : r.ok === false ? 'FALTA' : '??  ';
  if (r.ok === true) exist++; else if (r.ok === false) missing++; else unknown++;
  console.log(`  [${mark}] ${r.t.padEnd(12)} ${r.note}`);
}
console.log(`\nResumo: ${exist} existem / ${missing} faltando / ${unknown} indefinidas (de ${TABLES.length})`);
// Define o codigo de saida sem chamar process.exit() abruptamente
// (evita a assertion do libuv no Windows com sockets keep-alive abertos).
process.exitCode = (missing || unknown) ? 1 : 0;
