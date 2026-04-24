'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../src/store/authStore';

export default function Page() {
  const { user, role, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      router.replace('/login');
    } else if (role === 'owner') {
      router.replace('/owner/dashboard');
    } else if (role === 'hosteller') {
      router.replace('/hosteller/home');
    } else {
      router.replace('/login');
    }
  }, [user, role, loading, router]);

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center animate-pulse">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <p className="text-ink-400 text-sm font-medium">Loading HostelOS...</p>
      </div>
    </div>
  );
}
