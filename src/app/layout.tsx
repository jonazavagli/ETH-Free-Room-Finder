import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { SettingsProvider } from '@/components/SettingsProvider';

export const metadata: Metadata = {
  title: 'Free Room Finder · ETH Zürich & UZH',
  description: 'Unofficial student tool to find free study rooms at ETH Zürich and UZH today.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Free Rooms',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f52ba',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <SettingsProvider>{children}</SettingsProvider>
        <Analytics />
      </body>
    </html>
  );
}
