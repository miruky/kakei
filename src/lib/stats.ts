// 集計。月キーはYYYY-MM文字列で扱い、タイムゾーン起因のずれを避ける。

import type { Entry } from './ledger';

export interface MonthSummary {
  month: string;
  expense: number;
  income: number;
  balance: number;
}

export interface CategoryShare {
  category: string;
  amount: number;
  ratio: number;
}

// todayの月を末尾に、過去n個月のキーを昇順で返す。
export function lastMonths(today: string, n: number): string[] {
  const [y, m] = today.split('-').map(Number);
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1 - i, 1));
    months.push(dt.toISOString().slice(0, 7));
  }
  return months;
}

export function monthlySummaries(entries: Entry[], today: string, n = 12): MonthSummary[] {
  const map = new Map<string, { expense: number; income: number }>();
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    const cur = map.get(key) ?? { expense: 0, income: 0 };
    if (e.kind === 'expense') cur.expense += e.amount;
    else cur.income += e.amount;
    map.set(key, cur);
  }
  return lastMonths(today, n).map((month) => {
    const cur = map.get(month) ?? { expense: 0, income: 0 };
    return {
      month,
      expense: cur.expense,
      income: cur.income,
      balance: cur.income - cur.expense,
    };
  });
}

export function summarizeMonth(entries: Entry[], month: string): MonthSummary {
  let expense = 0;
  let income = 0;
  for (const e of entries) {
    if (!e.date.startsWith(month)) continue;
    if (e.kind === 'expense') expense += e.amount;
    else income += e.amount;
  }
  return { month, expense, income, balance: income - expense };
}

// 指定月の支出カテゴリ内訳。金額順、上位を超えたぶんは「その他」へ。
export function categoryShares(entries: Entry[], month: string, top = 6): CategoryShare[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.kind !== 'expense' || !e.date.startsWith(month)) continue;
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, top);
  const rest = sorted.slice(top).reduce((a, [, v]) => a + v, 0);
  const shares = head.map(([category, amount]) => ({
    category,
    amount,
    ratio: amount / total,
  }));
  if (rest > 0) {
    shares.push({ category: 'その他', amount: rest, ratio: rest / total });
  }
  return shares;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1 + delta, 1));
  return dt.toISOString().slice(0, 7);
}
