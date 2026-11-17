'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, Translations, translations } from '@/lib/i18n';
import { Info, Palette } from 'lucide-react';
import Link from 'next/link';

export type ThemeMode = 'light' | 'dark' | 'retro' | 'pastel' | 'tram';

export const ALL_THEMES: ThemeMode[] = ['light', 'dark', 'retro', 'pastel', 'tram'];

function isValidTheme(val: string | null): val is ThemeMode {
  return val !== null && ALL_THEMES.includes(val as ThemeMode);
}

interface SettingsContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  t: Translations;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_LANG_KEY = 'frf_lang';
const STORAGE_THEME_KEY = 'frf_theme';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');
  const [theme, setThemeState] = useState<ThemeMode>('light');

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem(STORAGE_LANG_KEY);
      if (savedLang === 'en' || savedLang === 'de') {
        setLangState(savedLang);
        document.documentElement.lang = savedLang;
      }
      const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
      if (isValidTheme(savedTheme)) {
        setThemeState(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch {
      // Ignore storage errors in private mode
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignore service worker registration errors in dev
      });
    }
  }, []);

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_LANG_KEY, next);
      document.documentElement.lang = next;
    } catch {
      // Ignore
    }
  };

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, next);
    } catch {
      // Ignore
    }
  };

  const t = translations[lang];

  const themeLabels: Record<ThemeMode, string> = {
    light: t.themeLight,
    dark: t.themeDark,
    retro: t.themeRetro,
    pastel: t.themePastel,
    tram: t.themeTram,
  };

  return (
    <SettingsContext.Provider value={{ lang, setLang, theme, setTheme, t }}>
      <div className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)]">
        {/* Skip to main content link for keyboard & screen-reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-[var(--accent-primary)] focus:px-3 focus:py-2 focus:text-xs focus:font-bold focus:text-[var(--accent-contrast)]"
        >
          {t.skipToContent}
        </a>

        <header className="sticky top-0 z-30 border-b border-[var(--border-color)] bg-[var(--bg-surface)]/95 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link
                href="/"
                className="text-lg font-bold tracking-tight text-[var(--text-primary)] hover:opacity-90"
              >
                {t.appName}
              </Link>
              <p className="text-xs text-[var(--text-muted)]">{t.unofficialBadge}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/about"
                data-testid="about-nav-link"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              >
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.aboutNavLabel}</span>
              </Link>

              <div
                role="group"
                aria-label={t.languageToggleLabel}
                className="inline-flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] p-0.5 text-xs font-semibold"
              >
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  aria-pressed={lang === 'en'}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    lang === 'en'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang('de')}
                  aria-pressed={lang === 'de'}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    lang === 'de'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  DE
                </button>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">
                <Palette className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <select
                  aria-label={t.themeToggleLabel}
                  data-testid="theme-selector"
                  value={theme}
                  onChange={(e) => {
                    if (isValidTheme(e.target.value)) {
                      setTheme(e.target.value);
                    }
                  }}
                  className="bg-transparent text-xs font-semibold text-[var(--text-primary)] cursor-pointer focus:outline-none"
                >
                  {ALL_THEMES.map((mode) => (
                    <option
                      key={mode}
                      value={mode}
                      className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    >
                      {themeLabels[mode]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 max-w-5xl w-full mx-auto px-4 py-5">
          {children}
        </main>

        <footer className="border-t border-[var(--border-color)] bg-[var(--bg-surface)] mt-8">
          <div className="max-w-5xl mx-auto px-4 py-4 text-xs text-[var(--text-muted)] flex flex-wrap items-center justify-between gap-2">
            <span>{t.unofficialBadge}</span>
            <Link
              href="/about"
              className="font-semibold text-[var(--accent-primary)] hover:underline"
            >
              {t.aboutNavLabel} &amp; Privacy
            </Link>
          </div>
        </footer>
      </div>
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return ctx;
}
