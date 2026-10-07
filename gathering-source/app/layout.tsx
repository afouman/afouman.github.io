import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import './globals.css';
const body = DM_Sans({ variable: '--font-body', subsets: ['latin'] });
const display = Fraunces({ variable: '--font-display', subsets: ['latin'] });
export const metadata: Metadata = {
  title: 'Nights — Every gathering, beautifully organized',
  description: 'RSVP, chat, browse menus, place orders, and keep every event in one place.',
  // Relative URLs deliberately keep the PWA inside /gathering/ on GitHub Pages.
  manifest: './manifest.webmanifest',
  icons: { icon: './icons/gather-favicon-48.png', apple: './icons/gather-app-icon-180.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Nights' },
  openGraph: { title: 'Nights', description: 'Every gathering, beautifully organized', images: ['./og.png'] },
  twitter: { card: 'summary_large_image', title: 'Nights', description: 'Every gathering, beautifully organized', images: ['./og.png'] },
};
export const viewport: Viewport = { themeColor: '#f7f2e8', viewportFit: 'cover' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={`${body.variable} ${display.variable}`}>{children}</body></html>; }
