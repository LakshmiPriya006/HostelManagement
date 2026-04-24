'use client';
import { usePathname } from 'next/navigation';
import HostellerLayout from '../../src/components/hosteller/HostellerLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/hosteller/login' || pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <HostellerLayout>
      {children}
    </HostellerLayout>
  );
}
