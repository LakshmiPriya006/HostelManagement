'use client';
import { usePathname } from 'next/navigation';
import OwnerLayout from '../../src/components/owner/OwnerLayout';
import AiAssistant from '../../src/components/owner/AiAssistant';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/owner/login' || pathname === '/owner/signup' || pathname === '/owner/setup' || pathname === '/login' || pathname === '/signup') {
    return <>{children}</>;
  }

  return (
    <OwnerLayout>
      {children}
      <AiAssistant />
    </OwnerLayout>
  );
}
