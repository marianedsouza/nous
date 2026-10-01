import { sb, many, maybe } from './db.js';

/** Data "de hoje" do sistema. No piloto era fixa; mantida configuravel. */
export const TODAY = process.env.SYSTEM_TODAY || '2026-09-18';

/** Wrapper para tratar erros em handlers async. */
export function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Busca ficha tecnica por nome de preparacao (case-insensitive). */
export function sheetByPrep(prep) {
  return maybe(sb.from('sheets').select('*').ilike('prep', prep));
}

/** Retorna o menu (com itens) de uma data, ou null. Uma unica chamada (join embutido). */
export async function menuByDate(date) {
  const menu = await maybe(sb.from('menus').select('*, menu_items(name, position)').eq('date', date));
  if (!menu) return null;
  const items = (menu.menu_items || [])
    .sort((a, b) => a.position - b.position)
    .map((i) => i.name);
  return { id: menu.id, date: menu.date, published: !!menu.published, items };
}

/** Quantidade de producao registrada para (date, prep). */
export async function prodQty(date, prep) {
  const row = await maybe(sb.from('production').select('qty').eq('date', date).eq('prep', prep));
  return row ? Number(row.qty) : 0;
}

/**
 * Custo alimentar de um dia = soma(custo_ficha * qtd_producao) dos itens do cardapio.
 * Otimizado: busca fichas e producao em LOTE (2 chamadas), evitando N+1 round-trips ao Supabase.
 */
export async function foodCostFor(date) {
  const menu = await menuByDate(date);
  if (!menu || menu.items.length === 0) return 0;

  const [sheets, prod] = await Promise.all([
    many(sb.from('sheets').select('prep,cost').in('prep', menu.items)),
    many(sb.from('production').select('prep,qty').eq('date', date).in('prep', menu.items)),
  ]);

  const costByPrep = new Map(sheets.map((s) => [s.prep.toLowerCase(), Number(s.cost)]));
  const qtyByPrep = new Map(prod.map((p) => [p.prep.toLowerCase(), Number(p.qty)]));

  let total = 0;
  for (const prep of menu.items) {
    const cost = costByPrep.get(prep.toLowerCase());
    const qty = qtyByPrep.get(prep.toLowerCase()) || 0;
    if (cost != null) total += cost * qty;
  }
  return total;
}

/** Custos fixos (linha id=1). */
export async function fixedCosts() {
  return (await maybe(sb.from('fixed_costs').select('*').eq('id', 1)))
    || { labor: 0, rent: 0, utilities: 0, taxes: 0, other: 0, days: 26 };
}

/** Rateio diario dos custos operacionais. */
export async function fixedDay() {
  const f = await fixedCosts();
  const total = Number(f.labor) + Number(f.rent) + Number(f.utilities) + Number(f.taxes) + Number(f.other);
  return total / Math.max(1, Number(f.days));
}

/**
 * Monta o resultado de um dia a partir de valores ja calculados.
 * (puro, sem I/O)
 */
export function computeResult(d, food, op) {
  const rev = Number(d.clients) * Number(d.price) + Number(d.other_revenue || 0);
  const res = rev - food - op;
  return {
    food, rev, op, res,
    margin: rev ? (res / rev) * 100 : 0,
    costClient: d.clients ? (food + op) / d.clients : 0,
  };
}

/**
 * Calcula o resultado de um dia (busca rateio e custo alimentar quando necessario).
 * Para varios dias, prefira resultForMany para nao refazer fixedDay a cada dia.
 */
export async function resultFor(d) {
  const op = await fixedDay();
  const food = (d.food == null && d.date === TODAY) ? await foodCostFor(d.date) : Number(d.food || 0);
  return computeResult(d, food, op);
}

/**
 * Resultado para uma lista de dias: calcula o rateio UMA vez e so busca
 * custo alimentar dinamico para o dia de hoje. Minimiza round-trips.
 */
export async function resultForMany(days) {
  const op = await fixedDay();
  const out = [];
  for (const d of days) {
    const food = (d.food == null && d.date === TODAY) ? await foodCostFor(d.date) : Number(d.food || 0);
    out.push({ date: d.date, clients: d.clients, price: d.price, other_revenue: d.other_revenue, ...computeResult(d, food, op) });
  }
  return out;
}
