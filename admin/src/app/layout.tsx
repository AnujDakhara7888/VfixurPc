import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';
import ReactQueryProvider from '@/components/ReactQueryProvider';

export const metadata: Metadata = {
  title: 'VfixurPC Admin',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'VfixurPC', statusBarStyle: 'default' },
  icons: { apple: '/app-icon.png', icon: '/app-icon.png' },
  description: 'Admin dashboard for VfixurPC doorstep repair platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" />
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
