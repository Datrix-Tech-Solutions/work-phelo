import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WorkPhelo ERP',
  description: 'Modern ERP for African businesses',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
