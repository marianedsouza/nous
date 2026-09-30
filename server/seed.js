import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, q1, exec, tx } from './db.js';

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

async function insertDemoData(client) {
  // usuarios
  for (const u of DEMO_USERS) {
    await client.query(
      `INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)
       ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, bcrypt.hashSync(u.pass, 10), u.role]
    );
  }
  // settings
  await client.query(`INSERT INTO settings (key,value) VALUES ('unit_name','Torquatu''s') ON CONFLICT (key) DO NOTHING`);
  // menus + items
  for (const m of MENUS) {
    const r = await client.query(
      `INSERT INTO menus (date,published) VALUES ($1,$2)
       ON CONFLICT (date) DO UPDATE SET published=EXCLUDED.published RETURNING id`,
      [m.date, m.published]
    );
    const menuId = r.rows[0].id;
    await client.query('DELETE FROM menu_items WHERE menu_id=$1', [menuId]);
    for (let i = 0; i < m.items.length; i++) {
      await client.query('INSERT INTO menu_items (menu_id,name,position) VALUES ($1,$2,$3)', [menuId, m.items[i], i]);
    }
  }
  // sheets
  for (const s of SHEETS) {
    await client.query(
      `INSERT INTO sheets (prep,cat,ingredients,yield,cost,method,rev,obs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [s.prep, s.cat, s.ingredients, s.yield, s.cost, s.method, s.rev, s.obs]
    );
  }
  // production
  for (const [prep, qty] of Object.entries(PROD)) {
    await client.query(
      `INSERT INTO production (date,prep,qty) VALUES ($1,$2,$3) ON CONFLICT (date,prep) DO UPDATE SET qty=EXCLUDED.qty`,
      ['2026-09-18', prep, qty]
    );
  }
  // docs (metadados demo, sem arquivo)
  for (const d of DOCS) {
    await client.query('INSERT INTO docs (type,expiry,filename) VALUES ($1,$2,$3)', [d.type, d.expiry, d.filename]);
  }
  // employees
  await client.query(
    `INSERT INTO employees (name,job,admission,course,course_expiry,health,health_expiry)
     VALUES ('Maria da Silva','Cozinheira','2026-02-10',true,'2027-02-10',true,'2026-11-30')`
  );
  // temps + samples
  await client.query(`INSERT INTO temps (dt,type,place,value,status) VALUES ('18/09/2026 11:32','Equipamento','Câmara fria',8.1,'Requer análise da RT')`);
  await client.query(`INSERT INTO samples (date,prep,time) VALUES ('18/09/2026','Arroz branco','11:20')`);
  // fixed_costs (linha unica)
  await client.query(
    `INSERT INTO fixed_costs (id,labor,rent,utilities,taxes,other,days) VALUES (1,14000,5000,4500,3500,2500,26)
     ON CONFLICT (id) DO UPDATE SET labor=EXCLUDED.labor,rent=EXCLUDED.rent,utilities=EXCLUDED.utilities,taxes=EXCLUDED.taxes,other=EXCLUDED.other,days=EXCLUDED.days`
  );
  // daily
  for (const d of DAILY) {
    await client.query(
      `INSERT INTO daily (date,clients,price,other_revenue,food) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (date) DO UPDATE SET clients=EXCLUDED.clients,price=EXCLUDED.price,other_revenue=EXCLUDED.other_revenue,food=EXCLUDED.food`,
      [d.date, d.clients, d.price, d.other_revenue, d.food]
    );
  }
}

/**
 * Seed COMPLETO e DESTRUTIVO: limpa as tabelas de dados e recria a demonstracao.
 * Use manualmente: npm run seed:supabase
 */
export async function seed({ silent = false } = {}) {
  const log = (...a) => { if (!silent) console.log(...a); };
  await tx(async (client) => {
    for (const t of ['menu_items', 'menus', 'sheets', 'production', 'docs', 'employees', 'temps', 'samples', 'daily', 'fixed_costs', 'settings', 'users']) {
      await client.query(`DELETE FROM ${t}`);
    }
    await insertDemoData(client);
  });
  log('Seed concluido com sucesso.');
  log('Usuarios:');
  log('  RT      -> rt@nous.com / rt123');
  log('  Cozinha -> cozinha@nous.com / cozinha123');
  log('  Gestor  -> gestor@nous.com / gestor123');
}

/**
 * Bootstrap NAO-destrutivo: so popula a demonstracao se o banco estiver vazio
 * (nenhum usuario). Seguro para rodar no start / cold start serverless.
 */
export async function ensureSeeded() {
  try {
    const row = await q1('SELECT COUNT(*)::int AS c FROM users');
    if (!row || row.c === 0) {
      await tx((client) => insertDemoData(client));
      console.log('[bootstrap] Banco vazio: dados de demonstracao inseridos.');
    }
    // Garante a linha unica de custos fixos
    await exec('INSERT INTO fixed_costs (id,labor,rent,utilities,taxes,other,days) VALUES (1,0,0,0,0,0,26) ON CONFLICT (id) DO NOTHING');
  } catch (err) {
    console.error('[bootstrap] Falhou (verifique SUPABASE_DB_URL e o schema):', err.message);
  }
}

// Execucao manual: npm run seed:supabase
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seed().then(() => pool.end()).catch((e) => { console.error(e); pool.end(); process.exitCode = 1; });
}
