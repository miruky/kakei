// 台帳とCSVの相互変換。表計算で開けるよう種別は日本語、金額は素の整数で書く。
// 取り込みは緩く、書き出しはRFC4180準拠のエスケープで行う。純粋関数のみ。

import type { Entry, EntryKind, NewEntry } from './ledger';

const HEADER = ['日付', '種別', '金額', 'カテゴリ', 'メモ'];
const NEEDS_QUOTE = /[",\r\n]/;

function escapeCell(value: string): string {
  return NEEDS_QUOTE.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(entries: Entry[]): string {
  const lines = [HEADER.join(',')];
  for (const e of entries) {
    const cells = [
      e.date,
      e.kind === 'income' ? '収入' : '支出',
      String(e.amount),
      e.category,
      e.memo,
    ];
    lines.push(cells.map(escapeCell).join(','));
  }
  return lines.join('\r\n');
}

// RFC4180準拠の素朴なスキャナ。引用符・カンマ・改行を含むセルを扱う。
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeKind(raw: string): EntryKind {
  const v = raw.trim().toLowerCase();
  return v === '収入' || v === 'income' ? 'income' : 'expense';
}

export function fromCsv(text: string): NewEntry[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  if (rows.length === 0) return [];
  // 1行目が日付でなければ見出し行とみなして読み飛ばす。
  const first = rows[0]?.[0] ?? '';
  const start = /^\d{4}-\d{1,2}-\d{1,2}/.test(first) ? 0 : 1;
  const out: NewEntry[] = [];
  for (let i = start; i < rows.length; i++) {
    const cells = rows[i];
    if (cells === undefined) continue;
    if (cells.length <= 1 && (cells[0] ?? '').trim() === '') continue;
    const [date = '', kindRaw = '', amountRaw = '', category = '', memo = ''] = cells;
    out.push({
      date: date.trim(),
      kind: normalizeKind(kindRaw),
      amount: Number(amountRaw.replace(/[,\s円]/g, '')),
      category: category.trim(),
      memo: memo.trim(),
    });
  }
  return out;
}
