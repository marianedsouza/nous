// Aplica supabase/schema.sql no banco Postgres do Supabase.
//
// Requer a connection string no .env como SUPABASE_DB_URL, encontrada em:
//   Supabase > Project Settings > Database > Connection string (URI)
// Ex.: postgresql://postgres.<ref>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:5432/postgres
//
// Uso: npm run db:push:supabase

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = path.join(__dirname, '..', 'supabase', 'schema.sql');

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('\n[erro] SUPABASE_DB_URL não definido no .env.');
  console.error('A chave publishable NÃO cria tabelas. Você precisa da connection string do Postgres:');
  console.error('  Supabase > Project Settings > Database > Connection string (URI)\n');
  console.error('Depois adicione ao .env:');
  console.error('  SUPABASE_DB_URL=postgresql://postgres.<ref>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:5432/postgres\n');
  console.error('Alternativa sem senha: copie supabase/schema.sql e rode no SQL Editor do painel.\n');
  process.exit(1);
}

const sql = fs.readFileSync(SCHEMA, 'utf8');

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false }, // Supabase exige TLS
});

try {
  console.log('Conectando ao Postgres do Supabase...');
  await client.connect();
  console.log('Aplicando schema...');
  await client.query(sql);

  const { rows } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name;
  `);
  console.log('\nTabelas presentes no schema public:');
  rows.forEach(r => console.log('  • ' + r.table_name));
  console.log('\nMigração concluída com sucesso.');
} catch (err) {
  console.error('\n[erro] Falha ao aplicar o schema:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
