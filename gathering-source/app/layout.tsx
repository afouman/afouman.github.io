import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import './globals.css';
const body = DM_Sans({ variable: '--font-body', subsets: ['latin'] });
const display = Fraunces({ variable: '--font-display', subsets: ['latin'] });
export const metadata: Metadata = {
  title: 'Gather — Event menus made personal',
  description: 'Browse the menu, choose your dishes, and send your order straight to your host.',
  // Relative URLs deliberately keep the PWA inside /gathering/ on GitHub Pages.
  manifest: './manifest.webmanifest',
  icons: { icon: './favicon.svg', apple: './icons/gather-host-180.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Gather Host' },
  openGraph: { title: 'Gather', description: 'Event menus made personal', images: ['./og.png'] },
  twitter: { card: 'summary_large_image', title: 'Gather', description: 'Event menus made personal', images: ['./og.png'] },
};
export const viewport: Viewport = { themeColor: '#f7f2e8', viewportFit: 'cover' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={`${body.variable} ${display.variable}`}>{children}</body></html>; }
