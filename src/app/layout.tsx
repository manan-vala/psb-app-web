import type { Metadata, Viewport } from 'next';
import { Manrope, Work_Sans } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { BalanceProvider } from '@/context/BalanceContext';
import { TelemetryProvider } from '@/context/TelemetryContext';
import { Agentation } from "agentation";

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-work-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bob World — Aegis',
  description:
    'Web build of the PSB Identity Trust System banking app, with continuous risk scoring.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#fbf9f8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${workSans.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
        />
      </head>
      <body>
        {process.env.NODE_ENV === "development" && <Agentation />}
        <BalanceProvider>
          <TelemetryProvider>
            <AppShell>{children}</AppShell>
          </TelemetryProvider>
        </BalanceProvider>
      </body>
    </html>
  );
}
