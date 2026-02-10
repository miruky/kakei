// SVGチャートの組み立て。色はCSSカスタムプロパティを参照し、
// ライト・ダークのテーマに追従する。純粋関数のみ。

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 軸の上限を1・2・2.5・5×10^kへ切り上げる。
export function niceMax(value: number): number {
  if (value <= 1) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * base >= value) return m * base;
  }
  return 10 * base;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function axisLabel(n: number): string {
  if (n >= 10_000 && n % 10_000 === 0) return `${n / 10_000}万`;
  return n.toLocaleString('ja-JP');
}

export interface MonthBars {
  label: string;
  expense: number;
  income: number;
}

// 支出と収入を並べたグループ棒グラフ。
export function groupedBarChart(
  data: MonthBars[],
  opts: { width?: number; height?: number } = {},
): string {
  const width = opts.width ?? 640;
  const height = opts.height ?? 240;
  const left = 56;
  const right = 8;
  const top = 10;
  const bottom = 26;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.expense, d.income))));
  const band = data.length === 0 ? innerW : innerW / data.length;
  const barW = band * 0.3;

  const gridlines = [0, 0.5, 1]
    .map((r) => {
      const y = top + innerH * (1 - r);
      return (
        `<line x1="${left}" y1="${fmt(y)}" x2="${width - right}" y2="${fmt(y)}" class="grid"/>` +
        `<text x="${left - 6}" y="${fmt(y + 4)}" text-anchor="end" class="tick">${axisLabel(max * r)}</text>`
      );
    })
    .join('');

  const bars = data
    .map((d, i) => {
      const x0 = left + band * i + band / 2;
      const hExp = (d.expense / max) * innerH;
      const hInc = (d.income / max) * innerH;
      return (
        `<g class="bar" style="--i:${i}">` +
        `<rect class="bar-expense" x="${fmt(x0 - barW - 1)}" y="${fmt(top + innerH - hExp)}" width="${fmt(barW)}" height="${fmt(hExp)}" rx="2"><title>${escapeXml(d.label)} 支出 ${d.expense.toLocaleString('ja-JP')}円</title></rect>` +
        `<rect class="bar-income" x="${fmt(x0 + 1)}" y="${fmt(top + innerH - hInc)}" width="${fmt(barW)}" height="${fmt(hInc)}" rx="2"><title>${escapeXml(d.label)} 収入 ${d.income.toLocaleString('ja-JP')}円</title></rect>` +
        `<text x="${fmt(x0)}" y="${height - 8}" text-anchor="middle" class="tick">${escapeXml(d.label)}</text>` +
        `</g>`
      );
    })
    .join('');

  return (
    `<svg viewBox="0 0 ${width} ${height}" class="chart-bar" role="img" ` +
    `aria-label="月別の支出と収入の棒グラフ">` +
    gridlines +
    bars +
    `</svg>`
  );
}

export interface DonutSlice {
  label: string;
  value: number;
}

// 角度は12時方向を0として時計回り(ラジアン)。
export function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
): string {
  const pt = (r: number, a: number) => {
    const x = cx + r * Math.sin(a);
    const y = cy - r * Math.cos(a);
    return `${fmt(Math.round(x * 100) / 100)} ${fmt(Math.round(y * 100) / 100)}`;
  };
  const large = end - start > Math.PI ? 1 : 0;
  return (
    `M ${pt(rOuter, start)} ` +
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${pt(rOuter, end)} ` +
    `L ${pt(rInner, end)} ` +
    `A ${rInner} ${rInner} 0 ${large} 0 ${pt(rInner, start)} Z`
  );
}

export function donutChart(
  slices: DonutSlice[],
  opts: { size?: number; centerLabel?: string; centerSub?: string } = {},
): string {
  const size = opts.size ?? 200;
  const c = size / 2;
  const rOuter = c - 4;
  const rInner = rOuter * 0.62;
  const total = slices.reduce((a, s) => a + s.value, 0);

  let body = '';
  if (total > 0 && slices.length === 1) {
    const r = (rOuter + rInner) / 2;
    body =
      `<circle cx="${c}" cy="${c}" r="${fmt(r)}" fill="none" class="seg seg-0" ` +
      `stroke-width="${fmt(rOuter - rInner)}" style="--i:0">` +
      `<title>${escapeXml(slices[0]?.label ?? '')}: 100%</title></circle>`;
  } else if (total > 0) {
    let angle = 0;
    body = slices
      .map((s, i) => {
        const sweep = (s.value / total) * Math.PI * 2;
        const path = arcPath(c, c, rOuter, rInner, angle, angle + sweep);
        angle += sweep;
        const pct = Math.round((s.value / total) * 100);
        return (
          `<path d="${path}" class="seg seg-${i % 8}" style="--i:${i}">` +
          `<title>${escapeXml(s.label)}: ${pct}%</title></path>`
        );
      })
      .join('');
  }

  const center =
    opts.centerLabel === undefined
      ? ''
      : `<text x="${c}" y="${c - 2}" text-anchor="middle" class="donut-num">${escapeXml(opts.centerLabel)}</text>` +
        (opts.centerSub === undefined
          ? ''
          : `<text x="${c}" y="${c + 18}" text-anchor="middle" class="donut-sub">${escapeXml(opts.centerSub)}</text>`);

  const label = slices
    .map((s) => `${s.label}${total === 0 ? '' : Math.round((s.value / total) * 100) + '%'}`)
    .join('、');
  return (
    `<svg viewBox="0 0 ${size} ${size}" class="chart-donut" role="img" ` +
    `aria-label="${escapeXml('内訳: ' + (label === '' ? 'データなし' : label))}">` +
    body +
    center +
    `</svg>`
  );
}
