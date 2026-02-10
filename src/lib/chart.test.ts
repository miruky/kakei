import { describe, expect, it } from 'vitest';
import { arcPath, donutChart, escapeXml, groupedBarChart, niceMax } from './chart';

describe('niceMax', () => {
  it('1・2・2.5・5系列へ切り上げる', () => {
    expect(niceMax(7)).toBe(10);
    expect(niceMax(23000)).toBe(25000);
    expect(niceMax(180000)).toBe(200000);
    expect(niceMax(0)).toBe(1);
  });
});

describe('groupedBarChart', () => {
  const data = [
    { label: '5月', expense: 120000, income: 250000 },
    { label: '6月', expense: 90000, income: 0 },
  ];

  it('月ごとに支出と収入の棒を描く', () => {
    const svg = groupedBarChart(data);
    expect(svg.match(/bar-expense/g)).toHaveLength(2);
    expect(svg.match(/bar-income/g)).toHaveLength(2);
  });

  it('軸ラベルは万単位に丸める', () => {
    expect(groupedBarChart(data)).toContain('25万');
  });

  it('titleに金額の説明が入る', () => {
    expect(groupedBarChart(data)).toContain('5月 支出 120,000円');
  });

  it('ラベルをエスケープする', () => {
    const svg = groupedBarChart([{ label: '<6月>', expense: 1, income: 1 }]);
    expect(svg).toContain('&lt;6月&gt;');
  });
});

describe('arcPath / donutChart', () => {
  it('半周超はlarge-arcフラグ1', () => {
    expect(arcPath(100, 100, 90, 60, 0, Math.PI * 1.5)).toContain('A 90 90 0 1 1');
  });

  it('区分ごとのパスと割合', () => {
    const svg = donutChart([
      { label: '食費', value: 75 },
      { label: '住居', value: 25 },
    ]);
    expect(svg.match(/<path/g)).toHaveLength(2);
    expect(svg).toContain('食費: 75%');
  });

  it('1区分は環として描く', () => {
    expect(donutChart([{ label: '食費', value: 10 }])).toContain('<circle');
  });

  it('空データでも返る', () => {
    expect(donutChart([])).toContain('データなし');
  });
});

describe('escapeXml', () => {
  it('特殊文字を実体参照にする', () => {
    expect(escapeXml('<&>')).toBe('&lt;&amp;&gt;');
  });
});
