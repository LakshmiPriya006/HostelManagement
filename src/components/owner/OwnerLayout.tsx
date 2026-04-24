import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Grid3x3 as Grid3X3, CreditCard, Megaphone, Layers, Settings, Building2, ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useHostelStore } from '../../store/hostelStore';
import NotificationBell from '../shared/NotificationBell';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/owner/rooms', label: 'Room Manager', icon: Grid3X3 },
  { to: '/owner/rent', label: 'Rent Tracker', icon: CreditCard },
  { to: '/owner/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/owner/support', label: 'Problems & Feedback', icon: Layers },
  { to: '/owner/settings', label: 'Settings', icon: Settings },
];

interface OwnerLayoutProps {
  children: React.ReactNode;
}

export default function OwnerLayout({ children }: OwnerLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { ownerProfile, reset } = useAuthStore();
  const { hostels, selectedHostelId, setSelectedHostelId } = useHostelStore();
  const [showHostelDropdown, setShowHostelDropdown] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const selectedHostel = hostels.find(h => h.id === selectedHostelId);

  async function handleLogout() {
    await supabase.auth.signOut();
    reset();
    router.push('/owner/login');
    toast.success('Logged out successfully');
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-4 border-b border-ink-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Building2 size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-ink-900 truncate">{selectedHostel?.name || 'HostelOS'}</div>
            <div className="text-xs text-ink-400 font-medium">Owner Portal</div>
          </div>
        </div>

        {hostels.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowHostelDropdown(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-ink-50 hover:bg-primary-50 rounded-xl border border-ink-100 hover:border-primary-200 transition-all duration-150"
            >
              <div className="w-5 h-5 bg-primary-100 rounded-md flex items-center justify-center flex-shrink-0">
                <Building2 size={11} className="text-primary-600" />
              </div>
              <span className="flex-1 text-xs font-semibold text-ink-700 text-left truncate">
                {selectedHostel?.name || 'Select Hostel'}
              </span>
              <ChevronDown size={12} className={`text-ink-400 flex-shrink-0 transition-transform duration-150 ${showHostelDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showHostelDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-card-lg border border-ink-100 z-20 overflow-hidden animate-slide-up">
                {hostels.map(h => (
                  <button
                    key={h.id}
                    onClick={() => { setSelectedHostelId(h.id); setShowHostelDropdown(false); }}
                    className={`w-full text-left px-3 py-2.5 text-xs hover:bg-ink-50 transition-colors ${h.id === selectedHostelId ? 'font-bold text-primary-600 bg-primary-50' : 'text-ink-700 font-medium'}`}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            href={to}
            onClick={() => setMobileSidebarOpen(false)}
            className={`sidebar-link ${pathname === to ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}
          >
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-ink-100">
        <div className="flex items-center gap-3 mb-2 px-2 py-1.5">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-xs font-bold text-white">
              {ownerProfile?.name?.slice(0, 2).toUpperCase() || 'OW'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink-800 truncate">{ownerProfile?.name}</div>
            <div className="text-xs text-ink-400 truncate">{ownerProfile?.email}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="sidebar-link sidebar-link-inactive w-full">
          <LogOut size={17} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f0f6fb] overflow-hidden">
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-ink-100 shadow-card flex-shrink-0">
        <SidebarContent />
      </aside>

      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-64 bg-white h-full shadow-card-lg z-50">
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-ink-100 text-ink-500"
            >
              <X size={16} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-ink-100 shadow-card">
          <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-xl hover:bg-ink-100 transition-colors">
            <Menu size={20} className="text-ink-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <Building2 size={14} className="text-white" />
            </div>
            <span className="font-bold text-ink-900 text-sm truncate max-w-[140px]">{selectedHostel?.name || 'HostelOS'}</span>
          </div>
          <NotificationBell />
        </header>

        <header className="hidden lg:flex items-center justify-between px-6 py-3.5 bg-white border-b border-ink-100">
          <div>
            <span className="text-xs text-ink-400 font-medium">Manage your hostel operations</span>
          </div>
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
