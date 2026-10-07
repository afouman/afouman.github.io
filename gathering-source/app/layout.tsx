import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import './globals.css';
const body = DM_Sans({ variable: '--font-body', subsets: ['latin'] });
const display = Fraunces({ variable: '--font-display', subsets: ['latin'] });
export const metadata: Metadata = {
  title: 'Nights — Every gathering, beautifully organized',
  description: 'RSVP, chat, browse menus, place orders, and keep every event in one place.',
  // Shared absolute paths resolve to the same asset on GitHub Pages and gaemaj.tech,
  // including from nested event and /nights-guests/ routes.
  manifest: '/gathering/manifest.webmanifest',
  icons: {
    icon: [{ url: '/gathering/icons/nights-favicon-48.png', sizes: '48x48', type: 'image/png' }],
    apple: [{ url: '/gathering/icons/nights-app-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Nights' },
  openGraph: { title: 'Nights', description: 'Every gathering, beautifully organized', images: ['/gathering/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Nights', description: 'Every gathering, beautifully organized', images: ['/gathering/og.png'] },
};
export const viewport: Viewport = { themeColor: '#f7f2e8', viewportFit: 'cover' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={`${body.variable} ${display.variable}`}>{children}</body></html>; }
