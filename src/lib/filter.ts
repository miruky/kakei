// 記録の絞り込み。カテゴリ・メモ・金額のいずれかに語が含まれる行を残す。
// 空白区切りの語はすべて満たすもの(AND)に絞る。純粋関数。

import type { Entry } from './ledger';

function matches(entry: Entry, term: string): boolean {
  return (
    entry.category.toLowerCase().includes(term) ||
    entry.memo.toLowerCase().includes(term) ||
    String(entry.amount).includes(term)
  );
}

export function filterEntries(entries: Entry[], query: string): Entry[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t !== '');
  if (terms.length === 0) return entries;
  return entries.filter((entry) => terms.every((term) => matches(entry, term)));
}
