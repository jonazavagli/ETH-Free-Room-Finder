'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Database, Info, Mail, ShieldCheck } from 'lucide-react';
import { useSettings } from '@/components/SettingsProvider';

export default function AboutPage() {
  const { t } = useSettings();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-primary)] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>{t.roomPageBack}</span>
      </Link>

      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-7 shadow-xs space-y-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          {t.aboutHeading}
        </h1>

        {/* Unofficial Notice */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] p-4 space-y-1.5">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0" aria-hidden="true" />
            <span>{t.aboutUnofficialTitle}</span>
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            {t.aboutUnofficialBody}
          </p>
        </div>

        {/* Definitions */}
        <div className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            {t.aboutDefinitionsTitle}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            {t.aboutDefinitionsFree}
          </p>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            {t.aboutDefinitionsOccupancy}
          </p>
        </div>

        {/* Privacy & Stored Data */}
        <div className="space-y-2 border-t border-[var(--border-color)] pt-5">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
            <span>{t.aboutPrivacyTitle}</span>
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            {t.aboutPrivacyBody}
          </p>
        </div>

        {/* Data Sources & Credits */}
        <div className="space-y-2 border-t border-[var(--border-color)] pt-5">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
            <span>{t.aboutSourcesTitle}</span>
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            {t.aboutCreditsBody}
          </p>
        </div>

        {/* Contact & Removal Requests */}
        <div className="space-y-2 border-t border-[var(--border-color)] pt-5">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Mail className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
            <span>{t.aboutContactTitle}</span>
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            {t.aboutContactBody}{' '}
            <a
              href="mailto:jzavagli@ethz.ch"
              className="font-bold text-[var(--accent-primary)] hover:underline"
            >
              jzavagli@ethz.ch
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
