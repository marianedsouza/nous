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

/** Retorna o menu (com itens) de uma data, ou null. */
export async function menuByDate(date) {
  const menu = await maybe(sb.from('menus').select('*').eq('date', date));
  if (!menu) return null;
  const items = await many(sb.from('menu_items').select('name').eq('menu_id', menu.id).order('position'));
  return { ...menu, published: !!menu.published, items: items.map((i) => i.name) };
}

/** Quantidade de producao registrada para (date, prep). */
export async function prodQty(date, prep) {
  const row = await maybe(sb.from('production').select('qty').eq('date', date).eq('prep', prep));
  return row ? Number(row.qty) : 0;
}

/** Custo alimentar de um dia = soma(custo_ficha * qtd_producao) dos itens do cardapio. */
export async function foodCostFor(date) {
  const menu = await menuByDate(date);
  if (!menu) return 0;
  let total = 0;
  for (const prep of menu.items) {
    const s = await sheetByPrep(prep);
    if (s) total += Number(s.cost) * (await prodQty(date, prep));
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
 * Calcula o resultado de um dia.
 * Para o dia de hoje sem custo alimentar gravado, calcula dinamicamente.
 */
export async function resultFor(d) {
  const food = (d.food == null && d.date === TODAY) ? await foodCostFor(d.date) : Number(d.food || 0);
  const rev = Number(d.clients) * Number(d.price) + Number(d.other_revenue || 0);
  const op = await fixedDay();
  const res = rev - food - op;
  return {
    food,
    rev,
    op,
    res,
    margin: rev ? (res / rev) * 100 : 0,
    costClient: d.clients ? (food + op) / d.clients : 0,
  };
}
