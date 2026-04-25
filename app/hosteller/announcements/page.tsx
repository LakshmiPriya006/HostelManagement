'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Megaphone, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/store/authStore';
import EmptyState from '../../../src/components/shared/EmptyState';
import { timeAgo, formatDate } from '../../../src/utils';
import type { Announcement } from '../../../src/types';

export default function HostellerAnnouncements() {
  const { hostellerProfile } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hostellerProfile) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from('announcements')
      .select('*')
      .eq('hostel_id', hostellerProfile.hostel_id)
      .order('created_at', { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setAnnouncements(data || []);
    setLoading(false);
  }, [hostellerProfile]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Announcements</h1>
        <p className="text-sm text-slate-500">Messages from your hostel management</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Failed to load announcements</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : error ? null : announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements" description="Your hostel hasn't posted any announcements yet." />
      ) : (
        <div className="space-y-3">
          {announcements.map(ann => (
            <div key={ann.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Megaphone size={16} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{ann.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{ann.content}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Clock size={12} className="text-slate-400" />
                    <p className="text-xs text-slate-400">{timeAgo(ann.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
