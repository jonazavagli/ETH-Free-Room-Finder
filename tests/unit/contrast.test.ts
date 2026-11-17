import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = Number.parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseThemesFromGlobalsCss(cssContent: string): Record<string, Record<string, string>> {
  const themes: Record<string, Record<string, string>> = {};
  const blockRegex = /(?::root,\s*)?\[data-theme='([a-z]+)'\]\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(cssContent)) !== null) {
    const themeName = match[1]!;
    const body = match[2]!;
    const vars: Record<string, string> = {};
    const varRegex = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g;
    let vm: RegExpExecArray | null;
    while ((vm = varRegex.exec(body)) !== null) {
      vars[vm[1]!] = vm[2]!;
    }
    themes[themeName] = vars;
  }
  return themes;
}

describe('WCAG 2.1 AA Theme Contrast Verification (All 5 Themes)', () => {
  const cssPath = path.resolve(__dirname, '../../src/app/globals.css');
  const cssText = fs.readFileSync(cssPath, 'utf-8');
  const themes = parseThemesFromGlobalsCss(cssText);

  const expectedThemes = ['light', 'dark', 'retro', 'pastel', 'tram'];

  it('defines all 5 required themes in globals.css', () => {
    for (const name of expectedThemes) {
      expect(themes[name]).toBeDefined();
    }
  });

  for (const themeName of expectedThemes) {
    it(`passes WCAG AA (>= 4.5:1) for every text, link, button, and status badge pair in "${themeName}" theme`, () => {
      const t = themes[themeName]!;

      const pairs: Array<[string, string]> = [
        ['--text-primary', '--bg-page'],
        ['--text-primary', '--bg-surface'],
        ['--text-primary', '--bg-muted'],
        ['--text-secondary', '--bg-page'],
        ['--text-secondary', '--bg-surface'],
        ['--text-secondary', '--bg-muted'],
        ['--text-muted', '--bg-page'],
        ['--text-muted', '--bg-surface'],
        ['--text-muted', '--bg-muted'],
        ['--accent-primary', '--bg-page'],
        ['--accent-primary', '--bg-surface'],
        ['--accent-primary', '--bg-muted'],
        ['--accent-contrast', '--accent-primary'],
        ['--status-free-text', '--status-free-bg'],
        ['--status-booked-text', '--status-booked-bg'],
        ['--status-unknown-text', '--status-unknown-bg'],
      ];

      for (const [fgVar, bgVar] of pairs) {
        const fg = t[fgVar];
        const bg = t[bgVar];
        expect(fg, `${themeName} missing ${fgVar}`).toBeTruthy();
        expect(bg, `${themeName} missing ${bgVar}`).toBeTruthy();
        const ratio = contrastRatio(fg!, bg!);
        expect(
          ratio,
          `Theme "${themeName}" pair ${fgVar} (${fg}) on ${bgVar} (${bg}) had ratio ${ratio.toFixed(2)}:1 (< 4.5:1)`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
