import { describe, expect, it } from 'vitest';
import type { Entry, EntryKind } from './ledger';
import { categoryShares, lastMonths, monthlySummaries, shiftMonth, summarizeMonth } from './stats';

let seq = 0;
function entry(
  date: string,
  amount: number,
  kind: EntryKind = 'expense',
  category = '食費',
): Entry {
  return { id: `t${seq++}`, date, kind, amount, category, memo: '' };
}

describe('lastMonths / shiftMonth', () => {
  it('年境界をまたいで月キーを返す', () => {
    expect(lastMonths('2026-02-10', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('shiftMonthで前後の月へ動く', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('monthlySummaries', () => {
  it('支出と収入を月ごとに集計し、空の月は0で埋める', () => {
    const entries = [
      entry('2026-06-01', 3000),
      entry('2026-06-15', 250000, 'income'),
      entry('2026-04-10', 5000),
    ];
    const result = monthlySummaries(entries, '2026-06-13', 3);
    expect(result).toEqual([
      { month: '2026-04', expense: 5000, income: 0, balance: -5000 },
      { month: '2026-05', expense: 0, income: 0, balance: 0 },
      { month: '2026-06', expense: 3000, income: 250000, balance: 247000 },
    ]);
  });
});

describe('summarizeMonth', () => {
  it('指定月だけを合計する', () => {
    const entries = [
      entry('2026-06-01', 1000),
      entry('2026-06-02', 2000),
      entry('2026-05-31', 9999),
      entry('2026-06-25', 300000, 'income'),
    ];
    expect(summarizeMonth(entries, '2026-06')).toEqual({
      month: '2026-06',
      expense: 3000,
      income: 300000,
      balance: 297000,
    });
  });
});

describe('categoryShares', () => {
  it('支出だけを金額順に集計する', () => {
    const entries = [
      entry('2026-06-01', 3000, 'expense', '食費'),
      entry('2026-06-02', 6000, 'expense', '住居'),
      entry('2026-06-03', 1000, 'expense', '食費'),
      entry('2026-06-04', 50000, 'income', '給与'),
    ];
    const shares = categoryShares(entries, '2026-06');
    expect(shares.map((s) => s.category)).toEqual(['住居', '食費']);
    expect(shares[1]?.amount).toBe(4000);
    expect(shares[0]?.ratio).toBeCloseTo(0.6);
  });

  it('上位を超えるカテゴリはその他へまとめる', () => {
    const entries = ['A', 'B', 'C', 'D'].map((c, i) =>
      entry('2026-06-01', (4 - i) * 1000, 'expense', c),
    );
    const shares = categoryShares(entries, '2026-06', 2);
    expect(shares.map((s) => s.category)).toEqual(['A', 'B', 'その他']);
  });

  it('支出がなければ空配列', () => {
    expect(categoryShares([entry('2026-06-01', 100, 'income')], '2026-06')).toEqual([]);
  });
});
