import { describe, expect, it } from 'vitest';
import {
  isThemePref,
  nextPref,
  prefLabel,
  readPref,
  resolvePref,
  savePref,
  type ThemePref,
} from './theme';

// テストはnode環境で走るためStorageを自前のMapで模す。
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('isThemePref', () => {
  it('既知の値だけ受け入れる', () => {
    expect(isThemePref('system')).toBe(true);
    expect(isThemePref('light')).toBe(true);
    expect(isThemePref('dark')).toBe(true);
    expect(isThemePref('sepia')).toBe(false);
    expect(isThemePref(null)).toBe(false);
  });
});

describe('readPref / savePref', () => {
  it('未設定はsystemを返す', () => {
    expect(readPref(fakeStorage())).toBe('system');
  });

  it('壊れた値はsystemへ倒す', () => {
    expect(readPref(fakeStorage({ 'kakei:theme': 'neon' }))).toBe('system');
  });

  it('保存した値を読み戻せる', () => {
    const s = fakeStorage();
    savePref(s, 'dark');
    expect(readPref(s)).toBe('dark');
  });

  it('getItemが例外でもsystemを返す', () => {
    const broken = {
      getItem() {
        throw new Error('blocked');
      },
    };
    expect(readPref(broken)).toBe('system');
  });

  it('setItemが例外でも投げない', () => {
    const broken = {
      setItem() {
        throw new Error('blocked');
      },
    };
    expect(() => savePref(broken, 'light')).not.toThrow();
  });
});

describe('nextPref', () => {
  it('system→light→dark→systemで巡回する', () => {
    const seen: ThemePref[] = [];
    let p: ThemePref = 'system';
    for (let i = 0; i < 4; i++) {
      seen.push(p);
      p = nextPref(p);
    }
    expect(seen).toEqual(['system', 'light', 'dark', 'system']);
  });
});

describe('resolvePref', () => {
  it('systemは端末の明暗に従う', () => {
    expect(resolvePref('system', true)).toBe('dark');
    expect(resolvePref('system', false)).toBe('light');
  });

  it('固定指定は端末設定を無視する', () => {
    expect(resolvePref('light', true)).toBe('light');
    expect(resolvePref('dark', false)).toBe('dark');
  });
});

describe('prefLabel', () => {
  it('選好ごとに日本語の説明を返す', () => {
    expect(prefLabel('system')).toContain('端末');
    expect(prefLabel('light')).toContain('ライト');
    expect(prefLabel('dark')).toContain('ダーク');
  });
});
