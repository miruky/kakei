// 家計簿の台帳。金額は整数の円で持ち、浮動小数の誤差を持ち込まない。
// 保存先は注入されたストレージで、UIに依存しない。

export type EntryKind = 'expense' | 'income';

export interface Entry {
  id: string;
  date: string; // YYYY-MM-DD
  kind: EntryKind;
  amount: number; // 円(正の整数)
  category: string;
  memo: string;
}

export interface NewEntry {
  date: string;
  kind: EntryKind;
  amount: number;
  category?: string;
  memo?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ImportResult {
  added: number;
  skipped: number;
}

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

export const EXPENSE_CATEGORIES = [
  '食費',
  '日用品',
  '住居',
  '水道光熱',
  '通信',
  '交通',
  '医療',
  '交際',
  '趣味',
  '衣服',
  'その他',
];

export const INCOME_CATEGORIES = ['給与', '賞与', '副収入', 'その他'];

const STORAGE_KEY = 'kakei:v1';
const MAX_AMOUNT = 100_000_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function makeId(): string {
  const c = globalThis.crypto;
  if (c !== undefined && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return 'e-' + Math.random().toString(36).slice(2, 12);
}

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 0));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === (m ?? 1) - 1 && dt.getUTCDate() === d;
}

function validate(input: NewEntry): void {
  if (!isValidDate(input.date)) {
    throw new LedgerError('日付はYYYY-MM-DD形式で指定してください');
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new LedgerError('金額は1円以上の整数で入力してください');
  }
  if (input.amount > MAX_AMOUNT) {
    throw new LedgerError('金額が大きすぎます');
  }
  if (input.kind !== 'expense' && input.kind !== 'income') {
    throw new LedgerError('種別が不正です');
  }
}

function coerceEntry(value: unknown): Entry | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.date !== 'string' || !isValidDate(v.date)) return null;
  const amount =
    typeof v.amount === 'number' && Number.isFinite(v.amount) ? Math.round(v.amount) : 0;
  if (amount <= 0 || amount > MAX_AMOUNT) return null;
  const kind = v.kind === 'income' ? 'income' : 'expense';
  return {
    id: typeof v.id === 'string' && v.id !== '' ? v.id : makeId(),
    date: v.date,
    kind,
    amount,
    category: typeof v.category === 'string' && v.category !== '' ? v.category : 'その他',
    memo: typeof v.memo === 'string' ? v.memo : '',
  };
}

export class Ledger {
  private items: Entry[] = [];

  constructor(private storage: StorageLike) {
    this.load();
  }

  private load(): void {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) return;
    try {
      const data: unknown = JSON.parse(raw);
      const entries =
        typeof data === 'object' && data !== null
          ? (data as Record<string, unknown>).entries
          : null;
      if (!Array.isArray(entries)) return;
      this.items = entries.map(coerceEntry).filter((e): e is Entry => e !== null);
    } catch {
      // 壊れた保存データは読み飛ばす。
    }
  }

  private save(): void {
    this.storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ app: 'kakei', version: 1, entries: this.items }),
    );
  }

  all(): Entry[] {
    return [...this.items].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  count(): number {
    return this.items.length;
  }

  get(id: string): Entry | null {
    return this.items.find((e) => e.id === id) ?? null;
  }

  // month: YYYY-MM
  byMonth(month: string): Entry[] {
    return this.all().filter((e) => e.date.startsWith(month));
  }

  add(input: NewEntry): Entry {
    validate(input);
    const entry: Entry = {
      id: makeId(),
      date: input.date,
      kind: input.kind,
      amount: input.amount,
      category: (input.category ?? '').trim() || 'その他',
      memo: (input.memo ?? '').trim(),
    };
    this.items.push(entry);
    this.save();
    return entry;
  }

  update(id: string, input: NewEntry): Entry {
    const entry = this.get(id);
    if (entry === null) throw new LedgerError('対象の記録が見つかりません');
    validate(input);
    entry.date = input.date;
    entry.kind = input.kind;
    entry.amount = input.amount;
    entry.category = (input.category ?? '').trim() || 'その他';
    entry.memo = (input.memo ?? '').trim();
    this.save();
    return entry;
  }

  remove(id: string): void {
    const before = this.items.length;
    this.items = this.items.filter((e) => e.id !== id);
    if (this.items.length === before) {
      throw new LedgerError('対象の記録が見つかりません');
    }
    this.save();
  }

  exportJson(now: Date = new Date()): string {
    return JSON.stringify(
      {
        app: 'kakei',
        version: 1,
        exportedAt: now.toISOString(),
        entries: this.items,
      },
      null,
      2,
    );
  }

  importJson(text: string): ImportResult {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new LedgerError('JSONとして読み取れないファイルです');
    }
    const entries =
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>).entries : null;
    if (!Array.isArray(entries)) {
      throw new LedgerError('kakeiのエクスポート形式ではありません');
    }
    let added = 0;
    let skipped = 0;
    for (const raw of entries) {
      const entry = coerceEntry(raw);
      if (entry === null || this.items.some((e) => e.id === entry.id)) {
        skipped++;
      } else {
        this.items.push(entry);
        added++;
      }
    }
    this.save();
    return { added, skipped };
  }

  // 複数のNewEntryをまとめて取り込む(CSV取り込み用)。妥当なものだけ加える。
  addMany(inputs: NewEntry[]): ImportResult {
    let added = 0;
    let skipped = 0;
    for (const input of inputs) {
      try {
        validate(input);
      } catch {
        skipped++;
        continue;
      }
      this.items.push({
        id: makeId(),
        date: input.date,
        kind: input.kind,
        amount: input.amount,
        category: (input.category ?? '').trim() || 'その他',
        memo: (input.memo ?? '').trim(),
      });
      added++;
    }
    if (added > 0) this.save();
    return { added, skipped };
  }
}

export function formatYen(amount: number): string {
  return amount.toLocaleString('ja-JP') + '円';
}
