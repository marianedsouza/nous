import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, migrate } from './db.js';

/**
 * Popula o banco com dados de demonstracao equivalentes ao piloto V5.
 * Idempotente: limpa as tabelas de dados e usuarios demo antes de inserir.
 */
export function seed({ silent = false } = {}) {
  migrate();
  const log = (...a) => { if (!silent) console.log(...a); };

  const tx = db.exec.bind(db);
  db.exec('BEGIN');
  try {
    // Limpa dados (mantem schema)
    for (const t of ['menu_items', 'menus', 'sheets', 'production', 'docs', 'employees', 'temps', 'samples', 'daily', 'fixed_costs', 'users', 'settings']) {
      db.exec(`DELETE FROM ${t};`);
    }

    // ---- Usuarios (3 papeis) ----
    const users = [
      { name: 'Nutricionista RT', email: 'rt@nous.com', role: 'rt', pass: 'rt123' },
      { name: 'Equipe Cozinha', email: 'cozinha@nous.com', role: 'cozinha', pass: 'cozinha123' },
      { name: 'Gestor', email: 'gestor@nous.com', role: 'gestor', pass: 'gestor123' },
    ];
    const insUser = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)');
    for (const u of users) {
      insUser.run(u.name, u.email, bcrypt.hashSync(u.pass, 10), u.role);
    }

    // ---- Settings ----
    db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').run('unit_name', "Torquatu's");

    // ---- Menus + items ----
    const menus = [
      { date: '2026-09-18', published: 1, items: ['Arroz branco', 'Feijão carioca', 'Frango assado', 'Farofa de banana', 'Salada verde', 'Pavê'] },
      { date: '2026-09-19', published: 1, items: ['Arroz branco', 'Feijão carioca', 'Carne assada', 'Macarrão', 'Salada verde', 'Gelatina mosaico'] },
    ];
    const insMenu = db.prepare('INSERT INTO menus (date,published) VALUES (?,?)');
    const insItem = db.prepare('INSERT INTO menu_items (menu_id,name,position) VALUES (?,?,?)');
    for (const m of menus) {
      const r = insMenu.run(m.date, m.published);
      const menuId = Number(r.lastInsertRowid);
      m.items.forEach((it, i) => insItem.run(menuId, it, i));
    }

    // ---- Sheets ----
    const sheets = [
      { prep: 'Arroz branco', cat: 'Acompanhamento', ingredients: 'Arroz | 5 kg\nÓleo | 300 mL\nAlho | 150 g\nSal | 80 g', yield: '13,2 kg', cost: 56.5, method: 'Selecionar, lavar quando aplicável, refogar e cozinhar conforme padrão da unidade.', rev: '01', obs: '' },
      { prep: 'Feijão carioca', cat: 'Acompanhamento', ingredients: 'Feijão | 5 kg\nTemperos | padrão', yield: '10,5 kg', cost: 74.8, method: 'Selecionar, cozinhar e temperar conforme padrão.', rev: '01', obs: '' },
      { prep: 'Frango assado', cat: 'Proteína', ingredients: 'Frango | lote padrão\nTemperos | padrão', yield: 'Lote padrão', cost: 238.4, method: 'Temperar e assar conforme procedimento.', rev: '01', obs: '' },
    ];
    const insSheet = db.prepare('INSERT INTO sheets (prep,cat,ingredients,yield,cost,method,rev,obs) VALUES (?,?,?,?,?,?,?,?)');
    for (const s of sheets) insSheet.run(s.prep, s.cat, s.ingredients, s.yield, s.cost, s.method, s.rev, s.obs);

    // ---- Production (dia 2026-09-18) ----
    const prod = { 'Arroz branco': 1, 'Feijão carioca': 1, 'Frango assado': 1, 'Farofa de banana': 1, 'Salada verde': 1, 'Pavê': 1 };
    const insProd = db.prepare('INSERT INTO production (date,prep,qty) VALUES (?,?,?)');
    for (const [prep, qty] of Object.entries(prod)) insProd.run('2026-09-18', prep, qty);

    // ---- Docs (sem arquivo real, apenas metadados demo) ----
    const docs = [
      { type: 'Alvará sanitário', expiry: '2027-03-15', filename: 'alvara_sanitario.pdf' },
      { type: 'POP', expiry: '', filename: 'POP_Higienizacao.pdf' },
      { type: 'Laudo de dedetização', expiry: '2026-10-10', filename: 'dedetizacao.pdf' },
    ];
    const insDoc = db.prepare('INSERT INTO docs (type,expiry,filename,stored_name,mime,size) VALUES (?,?,?,?,?,?)');
    for (const d of docs) insDoc.run(d.type, d.expiry || null, d.filename, null, null, null);

    // ---- Employees ----
    db.prepare('INSERT INTO employees (name,job,admission,course,course_expiry,health,health_expiry) VALUES (?,?,?,?,?,?,?)')
      .run('Maria da Silva', 'Cozinheira', '2026-02-10', 1, '2027-02-10', 1, '2026-11-30');

    // ---- Temps + samples ----
    db.prepare('INSERT INTO temps (dt,type,place,value,status) VALUES (?,?,?,?,?)')
      .run('18/09/2026 11:32', 'Equipamento', 'Câmara fria', 8.1, 'Requer análise da RT');
    db.prepare('INSERT INTO samples (date,prep,time) VALUES (?,?,?)')
      .run('18/09/2026', 'Arroz branco', '11:20');

    // ---- Fixed costs (linha unica id=1) ----
    db.prepare('INSERT INTO fixed_costs (id,labor,rent,utilities,taxes,other,days) VALUES (1,?,?,?,?,?,?)')
      .run(14000, 5000, 4500, 3500, 2500, 26);

    // ---- Daily ----
    const daily = [
      { date: '2026-09-16', clients: 126, price: 39.9, other_revenue: 0, food: 1850 },
      { date: '2026-09-17', clients: 151, price: 39.9, other_revenue: 0, food: 2070 },
      { date: '2026-09-18', clients: 142, price: 39.9, other_revenue: 0, food: null },
    ];
    const insDaily = db.prepare('INSERT INTO daily (date,clients,price,other_revenue,food) VALUES (?,?,?,?,?)');
    for (const d of daily) insDaily.run(d.date, d.clients, d.price, d.other_revenue, d.food);

    db.exec('COMMIT');
    log('Seed concluido com sucesso.');
    log('Usuarios:');
    log('  RT      -> rt@nous.com / rt123');
    log('  Cozinha -> cozinha@nous.com / cozinha123');
    log('  Gestor  -> gestor@nous.com / gestor123');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Garante que exista pelo menos a linha de custos fixos e os usuarios base.
export function ensureSeeded() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (!row || row.c === 0) seed({ silent: true });
  // Garante fixed_costs id=1
  const fc = db.prepare('SELECT COUNT(*) AS c FROM fixed_costs').get();
  if (!fc || fc.c === 0) {
    db.prepare('INSERT INTO fixed_costs (id,labor,rent,utilities,taxes,other,days) VALUES (1,0,0,0,0,0,26)').run();
  }
}

// Permite rodar via `npm run seed`
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.js')) {
  seed();
}
