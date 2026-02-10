// テーマの選好を解決して保存する。表示はdata-theme属性で切り替わり、
// systemのときだけ端末のprefers-color-schemeに従う。DOMには触れず純粋に保つ。

export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'kakei:theme';
const ORDER: readonly ThemePref[] = ['system', 'light', 'dark'];

export function isThemePref(value: unknown): value is ThemePref {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function readPref(storage: Pick<Storage, 'getItem'>): ThemePref {
  try {
    const raw = storage.getItem(KEY);
    return isThemePref(raw) ? raw : 'system';
  } catch {
    // localStorageを触れない環境(プライベートモード等)では既定に倒す。
    return 'system';
  }
}

export function savePref(storage: Pick<Storage, 'setItem'>, pref: ThemePref): void {
  try {
    storage.setItem(KEY, pref);
  } catch {
    // 保存できなくても表示は続けられるので握り潰す。
  }
}

// system → light → dark → system の順に巡回する。
export function nextPref(pref: ThemePref): ThemePref {
  const i = ORDER.indexOf(pref);
  return ORDER[(i + 1) % ORDER.length] ?? 'system';
}

export function resolvePref(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

const LABELS: Record<ThemePref, string> = {
  system: '端末の設定に合わせる',
  light: 'ライトに固定',
  dark: 'ダークに固定',
};

export function prefLabel(pref: ThemePref): string {
  return LABELS[pref];
}
