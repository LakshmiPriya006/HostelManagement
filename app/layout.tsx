import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { ClientProvider } from './ClientProvider';
import { headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: 'HostelOS',
  description: 'Manage your hostels efficiently',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const hostname = headersList.get('host') || '';

  return (
    <html lang="en">
      <body>
        <ClientProvider hostname={hostname}>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '10px',
                background: '#1e293b',
                color: '#f8fafc',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
          {children}
        </ClientProvider>
      </body>
    </html>
  );
}
