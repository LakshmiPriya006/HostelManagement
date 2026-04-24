import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, CreditCard, Megaphone, Layers, LogOut, Building2, Menu, X, User } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import NotificationBell from '../shared/NotificationBell';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/hosteller/home', label: 'Home', icon: Home },
  { to: '/hosteller/rent', label: 'Rent', icon: CreditCard },
  { to: '/hosteller/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/hosteller/support', label: 'Problems & Feedback', icon: Layers },
  { to: '/hosteller/profile', label: 'Profile', icon: User },
];

export default function HostellerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hostellerProfile, reset } = useAuthStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [hostelName, setHostelName] = useState('');

  React.useEffect(() => {
    if (hostellerProfile?.hostel_id) {
      supabase.from('hostels').select('name').eq('id', hostellerProfile.hostel_id).maybeSingle()
        .then(({ data }) => { if (data?.name) setHostelName(data.name); });
    }

    // Access Revocation Check
    if (hostellerProfile && hostellerProfile.status !== 'active') {
      supabase.auth.signOut().then(() => {
        reset();
        router.push('/hosteller/login?error=Access%20revoked%20by%20owner');
      });
    }
  }, [hostellerProfile, reset, router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    reset();
    router.push('/hosteller/login');
    toast.success('Logged out successfully');
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-4 border-b border-ink-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Building2 size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-ink-900 truncate">{hostelName || 'HostelOS'}</div>
            <div className="text-xs text-ink-400 font-medium">Resident Portal</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link key={to} href={to} onClick={() => setMobileSidebarOpen(false)}
            className={`sidebar-link ${pathname === to ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}>
            <Icon size={17} /><span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-ink-100">
        <div className="flex items-center gap-3 mb-2 px-2 py-1.5">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-xs font-bold text-white">{hostellerProfile?.name?.slice(0, 2).toUpperCase() || 'H'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink-800 truncate">{hostellerProfile?.name}</div>
            <div className="text-xs text-ink-400 truncate">{hostellerProfile?.email}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="sidebar-link sidebar-link-inactive w-full">
          <LogOut size={17} /><span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f0f6fb] overflow-hidden">
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-ink-100 shadow-card flex-shrink-0">
        <SidebarContent />
      </aside>
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-56 bg-white h-full shadow-card-lg z-50">
            <button onClick={() => setMobileSidebarOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-ink-100 text-ink-500">
              <X size={16} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-ink-100 shadow-card">
          <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-xl hover:bg-ink-100 transition-colors"><Menu size={20} className="text-ink-600" /></button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <Building2 size={14} className="text-white" />
            </div>
            <span className="font-bold text-ink-900 text-sm truncate max-w-[140px]">{hostelName || 'HostelOS'}</span>
          </div>
          <NotificationBell />
        </header>
        <header className="hidden lg:flex items-center justify-between px-6 py-3.5 bg-white border-b border-ink-100">
          <span className="text-xs text-ink-400 font-medium">Resident Portal</span>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
