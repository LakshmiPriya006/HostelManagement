import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import type { Notification } from '../../types';
import { timeAgo } from '../../utils';

export default function NotificationBell() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const channelIdRef = useRef(`notif-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const channelName = `notifications-${user.id}-${channelIdRef.current}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function fetchNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data as Notification[]);
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  const unread = notifications.filter(n => !n.is_read).length;

  const typeIcons: Record<string, string> = {
    rent_reminder: '💰',
    announcement: '📢',
    feedback_request: '📝',
    problem_update: '🔧',
    general: '🔔',
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Bell size={20} className="text-slate-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-semibold text-slate-800 text-sm">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">No notifications yet</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors ${!n.is_read ? 'bg-primary-50/40' : ''}`}
                >
                  <span className="text-lg flex-shrink-0">{typeIcons[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 leading-snug">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1.5" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
