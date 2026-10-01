import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { sb, DOCS_BUCKET, must, countOf } from './db.js';

const DEMO_USERS = [
  { name: 'Nutricionista RT', email: 'rt@nous.com', role: 'rt', pass: 'rt123' },
  { name: 'Equipe Cozinha', email: 'cozinha@nous.com', role: 'cozinha', pass: 'cozinha123' },
  { name: 'Gestor', email: 'gestor@nous.com', role: 'gestor', pass: 'gestor123' },
];
const MENUS = [
  { date: '2026-09-18', published: true, items: ['Arroz branco', 'Feijão carioca', 'Frango assado', 'Farofa de banana', 'Salada verde', 'Pavê'] },
  { date: '2026-09-19', published: true, items: ['Arroz branco', 'Feijão carioca', 'Carne assada', 'Macarrão', 'Salada verde', 'Gelatina mosaico'] },
];
const SHEETS = [
  { prep: 'Arroz branco', cat: 'Acompanhamento', ingredients: 'Arroz | 5 kg\nÓleo | 300 mL\nAlho | 150 g\nSal | 80 g', yield: '13,2 kg', cost: 56.5, method: 'Selecionar, lavar quando aplicável, refogar e cozinhar conforme padrão da unidade.', rev: '01', obs: '' },
  { prep: 'Feijão carioca', cat: 'Acompanhamento', ingredients: 'Feijão | 5 kg\nTemperos | padrão', yield: '10,5 kg', cost: 74.8, method: 'Selecionar, cozinhar e temperar conforme padrão.', rev: '01', obs: '' },
  { prep: 'Frango assado', cat: 'Proteína', ingredients: 'Frango | lote padrão\nTemperos | padrão', yield: 'Lote padrão', cost: 238.4, method: 'Temperar e assar conforme procedimento.', rev: '01', obs: '' },
];
const PROD = { 'Arroz branco': 1, 'Feijão carioca': 1, 'Frango assado': 1, 'Farofa de banana': 1, 'Salada verde': 1, 'Pavê': 1 };
const DOCS = [
  { type: 'Alvará sanitário', expiry: '2027-03-15', filename: 'alvara_sanitario.pdf' },
  { type: 'POP', expiry: null, filename: 'POP_Higienizacao.pdf' },
  { type: 'Laudo de dedetização', expiry: '2026-10-10', filename: 'dedetizacao.pdf' },
];
const DAILY = [
  { date: '2026-09-16', clients: 126, price: 39.9, other_revenue: 0, food: 1850 },
  { date: '2026-09-17', clients: 151, price: 39.9, other_revenue: 0, food: 2070 },
  { date: '2026-09-18', clients: 142, price: 39.9, other_revenue: 0, food: null },
];

/** Cria o bucket de storage dos documentos (idempotente). */
export async function ensureBucket() {
  const { data } = await sb.storage.getBucket(DOCS_BUCKET);
  if (!data) {
    const { error } = await sb.storage.createBucket(DOCS_BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) {
      console.warn('[storage] nao foi possivel criar o bucket:', error.message);
    } else {
      console.log(`[storage] bucket "${DOCS_BUCKET}" pronto.`);
    }
  }
}

async function insertDemoData() {
  // usuarios (upsert por email)
  const users = DEMO_USERS.map((u) => ({ name: u.name, email: u.email, role: u.role, password_hash: bcrypt.hashSync(u.pass, 10) }));
  must(await sb.from('users').upsert(users, { onConflict: 'email' }));

  // settings
  must(await sb.from('settings').upsert({ key: 'unit_name', value: "Torquatu's" }, { onConflict: 'key' }));

  // menus + items
  for (const m of MENUS) {
    const menu = must(await sb.from('menus').upsert({ date: m.date, published: m.published }, { onConflict: 'date' }).select().single());
    must(await sb.from('menu_items').delete().eq('menu_id', menu.id));
    const rows = m.items.map((name, i) => ({ menu_id: menu.id, name, position: i }));
    must(await sb.from('menu_items').insert(rows));
  }

  // sheets
  must(await sb.from('sheets').insert(SHEETS));

  // production
  const prodRows = Object.entries(PROD).map(([prep, qty]) => ({ date: '2026-09-18', prep, qty }));
  must(await sb.from('production').upsert(prodRows, { onConflict: 'date,prep' }));

  // docs (metadados demo, sem arquivo)
  must(await sb.from('docs').insert(DOCS.map((d) => ({ type: d.type, expiry: d.expiry, filename: d.filename }))));

  // employees
  must(await sb.from('employees').insert({
    name: 'Maria da Silva', job: 'Cozinheira', admission: '2026-02-10',
    course: true, course_expiry: '2027-02-10', health: true, health_expiry: '2026-11-30',
  }));

  // temps + samples
  must(await sb.from('temps').insert({ dt: '18/09/2026 11:32', type: 'Equipamento', place: 'Câmara fria', value: 8.1, status: 'Requer análise da RT' }));
  must(await sb.from('samples').insert({ date: '18/09/2026', prep: 'Arroz branco', time: '11:20' }));

  // fixed_costs (linha unica)
  must(await sb.from('fixed_costs').upsert({ id: 1, labor: 14000, rent: 5000, utilities: 4500, taxes: 3500, other: 2500, days: 26 }, { onConflict: 'id' }));

  // daily
  must(await sb.from('daily').upsert(DAILY, { onConflict: 'date' }));
}

/** Seed COMPLETO e DESTRUTIVO. Uso manual: npm run seed:supabase */
export async function seed({ silent = false } = {}) {
  const log = (...a) => { if (!silent) console.log(...a); };
  // limpa (ordem respeitando FKs: menu_items antes de menus)
  const byId = ['menu_items', 'menus', 'sheets', 'production', 'docs', 'employees', 'temps', 'samples', 'daily', 'users'];
  for (const t of byId) must(await sb.from(t).delete().gt('id', 0));
  must(await sb.from('fixed_costs').delete().gte('id', 0));
  must(await sb.from('settings').delete().not('key', 'is', null)); // settings usa 'key' como PK
  await ensureBucket();
  await insertDemoData();
  log('Seed concluido com sucesso.');
  log('Usuarios: rt@nous.com/rt123 · cozinha@nous.com/cozinha123 · gestor@nous.com/gestor123');
}

/** Bootstrap NAO-destrutivo: popula demonstracao apenas se o banco estiver vazio. */
export async function ensureSeeded() {
  try {
    await ensureBucket();
    const users = await countOf(sb.from('users').select('*', { count: 'exact', head: true }));
    if (users === 0) {
      await insertDemoData();
      console.log('[bootstrap] Banco vazio: dados de demonstracao inseridos.');
    }
    // garante a linha unica de custos fixos
    must(await sb.from('fixed_costs').upsert({ id: 1 }, { onConflict: 'id', ignoreDuplicates: true }));
  } catch (err) {
    console.error('[bootstrap] Falhou (verifique SUPABASE_URL/SUPABASE_SECRET_KEY e o schema):', err.message);
  }
}

// Execucao manual
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
