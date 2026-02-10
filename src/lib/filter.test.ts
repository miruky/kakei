import { describe, expect, it } from 'vitest';
import { filterEntries } from './filter';
import type { Entry } from './ledger';

function entry(over: Partial<Entry>): Entry {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    date: over.date ?? '2026-06-01',
    kind: over.kind ?? 'expense',
    amount: over.amount ?? 1000,
    category: over.category ?? '食費',
    memo: over.memo ?? '',
  };
}

const sample: Entry[] = [
  entry({ category: '食費', memo: 'スーパー', amount: 2800 }),
  entry({ category: '交通', memo: '定期', amount: 12000 }),
  entry({ category: '趣味', memo: '映画 ポップコーン', amount: 1800 }),
];

describe('filterEntries', () => {
  it('空クエリは全件返す', () => {
    expect(filterEntries(sample, '')).toHaveLength(3);
    expect(filterEntries(sample, '   ')).toHaveLength(3);
  });

  it('カテゴリ名で絞り込む', () => {
    const r = filterEntries(sample, '交通');
    expect(r).toHaveLength(1);
    expect(r[0]?.memo).toBe('定期');
  });

  it('メモの部分一致で絞り込む', () => {
    expect(filterEntries(sample, '映画')).toHaveLength(1);
  });

  it('金額の文字列でも当たる', () => {
    expect(filterEntries(sample, '2800')).toHaveLength(1);
  });

  it('空白区切りの語はANDで効く', () => {
    expect(filterEntries(sample, '映画 ポップ')).toHaveLength(1);
    expect(filterEntries(sample, '映画 定期')).toHaveLength(0);
  });

  it('大文字小文字を無視する', () => {
    const items = [entry({ category: 'Cafe', memo: 'Latte' })];
    expect(filterEntries(items, 'latte')).toHaveLength(1);
  });
});
