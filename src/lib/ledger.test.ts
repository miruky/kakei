import { describe, expect, it } from 'vitest';
import type { StorageLike } from './ledger';
import { formatYen, isValidDate, Ledger, LedgerError } from './ledger';

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const base = {
  date: '2026-06-10',
  kind: 'expense' as const,
  amount: 1200,
  category: '食費',
};

describe('追加と検証', () => {
  it('追加した記録を取得できる', () => {
    const ledger = new Ledger(memoryStorage());
    const entry = ledger.add({ ...base, memo: '昼食' });
    expect(ledger.get(entry.id)?.amount).toBe(1200);
    expect(entry.memo).toBe('昼食');
  });

  it('カテゴリ未指定はその他になる', () => {
    const ledger = new Ledger(memoryStorage());
    expect(ledger.add({ ...base, category: undefined }).category).toBe('その他');
  });

  it('0円・負額・小数・過大を拒否する', () => {
    const ledger = new Ledger(memoryStorage());
    expect(() => ledger.add({ ...base, amount: 0 })).toThrow(LedgerError);
    expect(() => ledger.add({ ...base, amount: -100 })).toThrow(LedgerError);
    expect(() => ledger.add({ ...base, amount: 99.5 })).toThrow(LedgerError);
    expect(() => ledger.add({ ...base, amount: 200_000_000 })).toThrow(LedgerError);
  });

  it('不正な日付を拒否する', () => {
    const ledger = new Ledger(memoryStorage());
    expect(() => ledger.add({ ...base, date: '2026-02-30' })).toThrow('日付');
  });
});

describe('isValidDate', () => {
  it('うるう年と形式を判定する', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026/06/10')).toBe(false);
  });
});

describe('更新と削除', () => {
  it('記録を書き換えられる', () => {
    const ledger = new Ledger(memoryStorage());
    const entry = ledger.add(base);
    ledger.update(entry.id, { ...base, amount: 980, kind: 'income' });
    expect(ledger.get(entry.id)?.amount).toBe(980);
    expect(ledger.get(entry.id)?.kind).toBe('income');
  });

  it('存在しないIDはLedgerError', () => {
    const ledger = new Ledger(memoryStorage());
    expect(() => ledger.update('x', base)).toThrow(LedgerError);
    expect(() => ledger.remove('x')).toThrow(LedgerError);
  });
});

describe('一覧と月の絞り込み', () => {
  it('日付の新しい順に返す', () => {
    const ledger = new Ledger(memoryStorage());
    ledger.add({ ...base, date: '2026-06-01' });
    ledger.add({ ...base, date: '2026-06-12' });
    expect(ledger.all().map((e) => e.date)).toEqual(['2026-06-12', '2026-06-01']);
  });

  it('byMonthは指定月だけ返す', () => {
    const ledger = new Ledger(memoryStorage());
    ledger.add({ ...base, date: '2026-05-31' });
    ledger.add({ ...base, date: '2026-06-01' });
    expect(ledger.byMonth('2026-06')).toHaveLength(1);
  });
});

describe('永続化と入出力', () => {
  it('作り直しても台帳が再現される', () => {
    const storage = memoryStorage();
    new Ledger(storage).add(base);
    expect(new Ledger(storage).count()).toBe(1);
  });

  it('壊れた保存データは無視する', () => {
    const storage = memoryStorage();
    storage.setItem('kakei:v1', '{bad');
    expect(new Ledger(storage).count()).toBe(0);
  });

  it('エクスポートを取り込め、重複IDは読み飛ばす', () => {
    const ledger = new Ledger(memoryStorage());
    ledger.add(base);
    const other = new Ledger(memoryStorage());
    expect(other.importJson(ledger.exportJson())).toEqual({ added: 1, skipped: 0 });
    expect(other.importJson(ledger.exportJson())).toEqual({ added: 0, skipped: 1 });
  });

  it('不正な要素は数えながら読み飛ばす', () => {
    const ledger = new Ledger(memoryStorage());
    const json = JSON.stringify({
      entries: [{ date: '2026-06-01', kind: 'expense', amount: 100 }, { amount: -1 }, 'x'],
    });
    expect(ledger.importJson(json)).toEqual({ added: 1, skipped: 2 });
  });

  it('形式違いはLedgerError', () => {
    const ledger = new Ledger(memoryStorage());
    expect(() => ledger.importJson('not json')).toThrow(LedgerError);
    expect(() => ledger.importJson('{"a":1}')).toThrow('エクスポート形式');
  });
});

describe('formatYen', () => {
  it('桁区切りと円を付ける', () => {
    expect(formatYen(1234567)).toBe('1,234,567円');
  });
});
