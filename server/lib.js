import { db } from './db.js';

/** Data "de hoje" do sistema. No piloto era fixa; mantida configuravel. */
export const TODAY = process.env.SYSTEM_TODAY || '2026-09-18';

/** Wrapper para tratar erros em handlers async. */
export function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Busca ficha tecnica por nome de preparacao (case-insensitive). */
export function sheetByPrep(prep) {
  return db.prepare('SELECT * FROM sheets WHERE lower(prep) = lower(?)').get(prep);
}

/** Retorna o menu (com itens) de uma data, ou null. */
export function menuByDate(date) {
  const menu = db.prepare('SELECT * FROM menus WHERE date = ?').get(date);
  if (!menu) return null;
  const items = db.prepare('SELECT name FROM menu_items WHERE menu_id = ? ORDER BY position').all(menu.id);
  return { ...menu, published: !!menu.published, items: items.map(i => i.name) };
}

/** Quantidade de producao registrada para (date, prep). */
export function prodQty(date, prep) {
  const row = db.prepare('SELECT qty FROM production WHERE date = ? AND prep = ?').get(date, prep);
  return row ? Number(row.qty) : 0;
}

/** Custo alimentar de um dia = soma(custo_ficha * qtd_producao) dos itens do cardapio. */
export function foodCostFor(date) {
  const menu = menuByDate(date);
  if (!menu) return 0;
  return menu.items.reduce((acc, prep) => {
    const s = sheetByPrep(prep);
    return acc + (s ? Number(s.cost) * prodQty(date, prep) : 0);
  }, 0);
}

/** Custos fixos (linha id=1). */
export function fixedCosts() {
  return db.prepare('SELECT * FROM fixed_costs WHERE id = 1').get()
    || { labor: 0, rent: 0, utilities: 0, taxes: 0, other: 0, days: 26 };
}

/** Rateio diario dos custos operacionais. */
export function fixedDay() {
  const f = fixedCosts();
  const total = Number(f.labor) + Number(f.rent) + Number(f.utilities) + Number(f.taxes) + Number(f.other);
  return total / Math.max(1, Number(f.days));
}

/**
 * Calcula o resultado de um dia.
 * Para o dia de hoje sem custo alimentar gravado, calcula dinamicamente.
 */
export function resultFor(d) {
  const food = (d.food == null && d.date === TODAY) ? foodCostFor(d.date) : Number(d.food || 0);
  const rev = Number(d.clients) * Number(d.price) + Number(d.other_revenue || 0);
  const op = fixedDay();
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
