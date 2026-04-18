import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from '../components/providers';
import { ToastViewport } from '../components/ui/toast-viewport';

// The user requested a clean, premium, modern UI font handled tastefully.
// Inter fits perfectly with tight body tracking and looser label tracking.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const fantomen = localFont({
  src: '../../public/VFCFantomen.ttf',
  variable: '--font-fantomen',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NeuroStream',
  description: 'AI-powered video workflow administration',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${fantomen.variable} font-sans antialiased`} style={{ colorScheme: 'dark' }}>
      <body className="bg-[#030305] text-white selection:bg-[#635BFF]/30">
        <Providers>
          {children}
          <ToastViewport />
        </Providers>
      </body>
    </html>
  );
}
