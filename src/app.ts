// UI層。表示中の月とフォームの編集状態だけを持ち、データはLedgerに任せる。

import { donutChart, escapeXml, groupedBarChart } from './lib/chart';
import type { Entry, EntryKind, Ledger } from './lib/ledger';
import { EXPENSE_CATEGORIES, formatYen, INCOME_CATEGORIES, LedgerError } from './lib/ledger';
import { categoryShares, monthlySummaries, shiftMonth, summarizeMonth } from './lib/stats';

const esc = escapeXml;

const LOGO = `
<svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
  <rect x="10" y="8" width="44" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="3"/>
  <path d="M20 20h24M20 30h24" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
  <circle cx="32" cy="44" r="8" fill="none" stroke="var(--accent)" stroke-width="3"/>
  <path d="M32 40v8M29 42.5h6M29 45.5h6" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
</svg>`;

function todayLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function monthLabel(month: string): string {
  return `${Number(month.slice(0, 4))}年${Number(month.slice(5))}月`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function countUp(el: HTMLElement, target: number): void {
  if (prefersReducedMotion() || target === 0) {
    el.textContent = target.toLocaleString('ja-JP');
    return;
  }
  const duration = 500;
  const start = performance.now();
  const step = (t: number) => {
    const ratio = Math.min(1, (t - start) / duration);
    const eased = 1 - (1 - ratio) ** 3;
    el.textContent = Math.round(target * eased).toLocaleString('ja-JP');
    if (ratio < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function mountApp(root: HTMLElement, ledger: Ledger): void {
  let month = todayLocal().slice(0, 7);
  let editingId: string | null = null;

  root.innerHTML = `
    <div class="shell">
      <header class="masthead">
        <div class="brand">
          ${LOGO}
          <div>
            <h1>kakei</h1>
            <p class="tagline">ローカルに置く、静かな家計簿</p>
          </div>
        </div>
        <div class="masthead-actions">
          <button type="button" id="export" class="ghost">エクスポート</button>
          <button type="button" id="import" class="ghost">インポート</button>
          <input type="file" id="import-file" accept=".json,application/json" hidden>
        </div>
      </header>

      <section class="panel" aria-label="記録を付ける">
        <form id="entry-form" autocomplete="off">
          <fieldset class="kind-toggle">
            <legend class="visually-hidden">種別</legend>
            <label class="kind kind-expense"><input type="radio" name="kind" value="expense" checked>支出</label>
            <label class="kind kind-income"><input type="radio" name="kind" value="income">収入</label>
          </fieldset>
          <label>日付<input type="date" name="date" required></label>
          <label>金額<input type="number" name="amount" min="1" max="100000000" required placeholder="円"></label>
          <label>カテゴリ<input name="category" list="category-list" placeholder="食費など"></label>
          <label class="grow">メモ<input name="memo" placeholder="任意"></label>
          <div class="entry-buttons">
            <button type="submit" class="primary" id="entry-submit">記録する</button>
            <button type="button" id="entry-cancel" class="ghost" hidden>取りやめ</button>
          </div>
          <datalist id="category-list"></datalist>
        </form>
      </section>

      <nav class="month-nav" aria-label="表示する月">
        <button type="button" id="prev-month" class="ghost" aria-label="前の月">前月</button>
        <h2 id="month-label"></h2>
        <button type="button" id="next-month" class="ghost" aria-label="次の月">翌月</button>
      </nav>

      <section class="cards" id="cards" aria-label="月のまとめ"></section>

      <div class="charts">
        <section class="panel" aria-labelledby="trend-heading">
          <h3 id="trend-heading">月次推移(12か月)</h3>
          <div id="trend-chart"></div>
          <p class="chart-legend">
            <span class="key key-expense"></span>支出
            <span class="key key-income"></span>収入
          </p>
        </section>
        <section class="panel" aria-labelledby="share-heading">
          <h3 id="share-heading">支出の内訳</h3>
          <div class="donut-row">
            <div id="share-chart"></div>
            <ul id="share-legend" class="legend"></ul>
          </div>
        </section>
      </div>

      <section class="panel" aria-labelledby="entries-heading">
        <h3 id="entries-heading">記録の一覧</h3>
        <div id="entries"></div>
      </section>
      <div id="toast" role="status" aria-live="polite"></div>
    </div>`;

  const $ = <T extends HTMLElement>(selector: string): T => {
    const node = root.querySelector<T>(selector);
    if (node === null) throw new Error(`要素が見つからない: ${selector}`);
    return node;
  };

  const form = $<HTMLFormElement>('#entry-form');
  const field = <T extends HTMLElement>(name: string): T => {
    const node = form.elements.namedItem(name);
    if (node instanceof RadioNodeList) return node as unknown as T;
    if (!(node instanceof HTMLElement)) throw new Error(`入力が見つからない: ${name}`);
    return node as T;
  };
  const toastBox = $('#toast');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  function toast(message: string): void {
    toastBox.textContent = message;
    toastBox.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove('show'), 3500);
  }

  function currentKind(): EntryKind {
    const data = new FormData(form);
    return data.get('kind') === 'income' ? 'income' : 'expense';
  }

  function renderDatalist(): void {
    const presets = currentKind() === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const used = [...new Set(ledger.all().map((e) => e.category))];
    const items = [...new Set([...presets, ...used])];
    $('#category-list').innerHTML = items
      .map((c) => `<option value="${esc(c)}"></option>`)
      .join('');
  }

  function resetForm(): void {
    editingId = null;
    form.reset();
    field<HTMLInputElement>('date').value = todayLocal();
    $('#entry-submit').textContent = '記録する';
    $('#entry-cancel').hidden = true;
    renderDatalist();
  }

  function fillForm(entry: Entry): void {
    editingId = entry.id;
    (field('kind') as unknown as RadioNodeList).value = entry.kind;
    field<HTMLInputElement>('date').value = entry.date;
    field<HTMLInputElement>('amount').value = String(entry.amount);
    field<HTMLInputElement>('category').value = entry.category;
    field<HTMLInputElement>('memo').value = entry.memo;
    $('#entry-submit').textContent = '更新する';
    $('#entry-cancel').hidden = false;
    field<HTMLInputElement>('amount').focus();
  }

  function renderCards(): void {
    const s = summarizeMonth(ledger.all(), month);
    const cards = [
      { label: '支出', value: s.expense, cls: 'expense' },
      { label: '収入', value: s.income, cls: 'income' },
      { label: '収支', value: s.balance, cls: s.balance >= 0 ? 'income' : 'expense' },
    ];
    $('#cards').innerHTML = cards
      .map(
        (c, i) => `
        <div class="card" style="--i:${i}">
          <p class="card-label">${c.label}</p>
          <p class="card-value ${c.cls}">
            ${c.value < 0 ? '-' : ''}<span class="num" data-count="${Math.abs(c.value)}">0</span><span class="unit">円</span>
          </p>
        </div>`,
      )
      .join('');
    root.querySelectorAll<HTMLElement>('.num').forEach((el) => {
      countUp(el, Number(el.dataset.count ?? 0));
    });
  }

  function renderCharts(): void {
    const entries = ledger.all();
    const trend = monthlySummaries(entries, `${month}-15`, 12).map((m) => ({
      label: `${Number(m.month.slice(5))}月`,
      expense: m.expense,
      income: m.income,
    }));
    $('#trend-chart').innerHTML = groupedBarChart(trend);

    const shares = categoryShares(entries, month);
    const total = shares.reduce((a, s) => a + s.amount, 0);
    $('#share-chart').innerHTML = donutChart(
      shares.map((s) => ({ label: s.category, value: s.amount })),
      {
        centerLabel: total === 0 ? '' : Math.round(total / 1000).toLocaleString('ja-JP'),
        centerSub: total === 0 ? '' : '千円',
      },
    );
    $('#share-legend').innerHTML = shares
      .map(
        (s, i) => `
        <li style="--i:${i}"><span class="swatch seg-${i % 8}" aria-hidden="true"></span>
          ${esc(s.category)}<span class="legend-amount">${formatYen(s.amount)}</span></li>`,
      )
      .join('');
  }

  function renderEntries(): void {
    const entries = ledger.byMonth(month);
    if (entries.length === 0) {
      $('#entries').innerHTML =
        '<p class="empty">この月の記録はまだありません。上のフォームから付けられます。</p>';
      return;
    }
    const rows = entries
      .map(
        (e) => `
        <tr>
          <td class="cell-date">${Number(e.date.slice(8))}日</td>
          <td>${esc(e.category)}</td>
          <td class="cell-memo">${esc(e.memo)}</td>
          <td class="cell-amount ${e.kind}">${e.kind === 'expense' ? '-' : '+'}${e.amount.toLocaleString('ja-JP')}</td>
          <td class="cell-ops">
            <button type="button" data-edit="${esc(e.id)}" class="link">編集</button>
            <button type="button" data-remove="${esc(e.id)}" class="link">削除</button>
          </td>
        </tr>`,
      )
      .join('');
    $('#entries').innerHTML = `
      <table>
        <thead><tr><th scope="col">日</th><th scope="col">カテゴリ</th><th scope="col">メモ</th><th scope="col">金額</th><th scope="col"><span class="visually-hidden">操作</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function render(): void {
    $('#month-label').textContent = monthLabel(month);
    renderCards();
    renderCharts();
    renderEntries();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const input = {
      date: String(data.get('date') ?? ''),
      kind: currentKind(),
      amount: Number(data.get('amount')),
      category: String(data.get('category') ?? ''),
      memo: String(data.get('memo') ?? ''),
    };
    try {
      if (editingId === null) {
        const entry = ledger.add(input);
        toast(`${entry.category} ${formatYen(entry.amount)}を記録しました`);
        month = entry.date.slice(0, 7);
      } else {
        ledger.update(editingId, input);
        toast('記録を更新しました');
      }
      resetForm();
      render();
    } catch (err) {
      toast(err instanceof LedgerError ? err.message : '記録に失敗しました');
    }
  });

  form.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).getAttribute('name') === 'kind') renderDatalist();
  });

  $('#entry-cancel').addEventListener('click', resetForm);

  $('#prev-month').addEventListener('click', () => {
    month = shiftMonth(month, -1);
    render();
  });

  $('#next-month').addEventListener('click', () => {
    month = shiftMonth(month, 1);
    render();
  });

  $('#entries').parentElement?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const edit = target.closest<HTMLElement>('[data-edit]');
    if (edit !== null) {
      const entry = ledger.get(edit.dataset.edit ?? '');
      if (entry !== null) fillForm(entry);
      return;
    }
    const remove = target.closest<HTMLElement>('[data-remove]');
    if (remove !== null) {
      if (remove.dataset.armed === undefined) {
        remove.dataset.armed = '1';
        remove.textContent = '本当に削除';
        return;
      }
      ledger.remove(remove.dataset.remove ?? '');
      if (editingId === remove.dataset.remove) resetForm();
      toast('記録を削除しました');
      render();
    }
  });

  $('#export').addEventListener('click', () => {
    const stamp = todayLocal().replace(/-/g, '');
    const blob = new Blob([ledger.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kakei-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('台帳をエクスポートしました');
  });

  $('#import').addEventListener('click', () => {
    $<HTMLInputElement>('#import-file').click();
  });

  $<HTMLInputElement>('#import-file').addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) return;
    void file.text().then((text) => {
      try {
        const result = ledger.importJson(text);
        toast(`${result.added}件を取り込みました(${result.skipped}件は読み飛ばし)`);
        render();
      } catch (err) {
        toast(err instanceof LedgerError ? err.message : '読み込みに失敗しました');
      }
    });
  });

  resetForm();
  render();
}
