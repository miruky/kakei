import { describe, expect, it } from 'vitest';
import { fromCsv, parseCsv, toCsv } from './csv';
import type { Entry } from './ledger';

const entries: Entry[] = [
  { id: '1', date: '2026-06-01', kind: 'expense', amount: 2800, category: '食費', memo: '昼食' },
  { id: '2', date: '2026-06-03', kind: 'income', amount: 280000, category: '給与', memo: '' },
  {
    id: '3',
    date: '2026-06-05',
    kind: 'expense',
    amount: 1200,
    category: '日用品',
    memo: 'メモに,カンマと"引用"',
  },
];

describe('toCsv', () => {
  it('見出しと種別の日本語を書き出す', () => {
    const lines = toCsv(entries).split('\r\n');
    expect(lines[0]).toBe('日付,種別,金額,カテゴリ,メモ');
    expect(lines[1]).toBe('2026-06-01,支出,2800,食費,昼食');
    expect(lines[2]).toContain('収入');
  });

  it('カンマや引用符を含むセルを正しくエスケープする', () => {
    const csv = toCsv([entries[2] as Entry]);
    expect(csv.split('\r\n')[1]).toBe('2026-06-05,支出,1200,日用品,"メモに,カンマと""引用"""');
  });
});

describe('parseCsv', () => {
  it('引用符の中の改行とカンマを保持する', () => {
    const rows = parseCsv('a,"b,c\nd",e');
    expect(rows).toEqual([['a', 'b,c\nd', 'e']]);
  });

  it('末尾改行で空行を作らない', () => {
    expect(parseCsv('x,y\n')).toEqual([['x', 'y']]);
  });

  it('空文字は空配列', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('toCsv / fromCsv round-trip', () => {
  it('書き出してから読み戻すと値が一致する', () => {
    const parsed = fromCsv(toCsv(entries));
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({
      date: '2026-06-01',
      kind: 'expense',
      amount: 2800,
      category: '食費',
      memo: '昼食',
    });
    expect(parsed[1]?.kind).toBe('income');
    expect(parsed[2]?.memo).toBe('メモに,カンマと"引用"');
  });
});

describe('fromCsv', () => {
  it('見出し行が無くても読める', () => {
    const parsed = fromCsv('2026-06-10,支出,500,交通,バス');
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.amount).toBe(500);
  });

  it('BOM付き・全角金額のゆれを吸収する', () => {
    const parsed = fromCsv('﻿日付,種別,金額,カテゴリ,メモ\r\n2026-06-10,収入,"9,000",副収入,');
    expect(parsed[0]).toMatchObject({ kind: 'income', amount: 9000, category: '副収入' });
  });

  it('空行は読み飛ばす', () => {
    expect(fromCsv('2026-06-01,支出,100,食費,\n\n')).toHaveLength(1);
  });
});
