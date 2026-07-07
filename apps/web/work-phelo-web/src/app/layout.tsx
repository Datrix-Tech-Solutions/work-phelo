import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ToastContainer } from '@/components/molecules/shared/ToastContainer';
import { ModuleSplash } from '@/components/molecules/shared/ModuleSplash';
import { appFont } from '@/lib/fonts';

export const metadata: Metadata = {
  title: 'WorkPhelo ERP',
  description: 'Modern ERP for African businesses',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={appFont.variable}>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
        <ToastContainer />
        <ModuleSplash />
      </body>
    </html>
  );
}
