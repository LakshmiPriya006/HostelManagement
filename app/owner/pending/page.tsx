'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, User, Phone, Mail, MapPin, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { useHostelStore } from '../../../src/store/hostelStore';
import { formatDate } from '../../../src/utils';
import { createNotification } from '../../../src/services/notifications';
import toast from 'react-hot-toast';
import type { Hosteller, Room } from '../../../src/types';

interface PendingRow {
  hosteller: Hosteller;
  room: Room | undefined;
}

export default function PendingApprovals() {
  const { selectedHostelId } = useHostelStore();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedHostelId) return;
    setLoading(true);
    const [hosRes, roomRes] = await Promise.all([
      supabase.from('hostellers').select('*').eq('hostel_id', selectedHostelId).eq('approval_status', 'pending'),
      supabase.from('rooms').select('*').eq('hostel_id', selectedHostelId),
    ]);
    const hostellers: Hosteller[] = hosRes.data || [];
    const rooms: Room[] = roomRes.data || [];
    setRows(hostellers.map(h => ({ hosteller: h, room: rooms.find(r => r.id === h.room_id) })));
    setLoading(false);
  }, [selectedHostelId]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(hosteller: Hosteller) {
    setActionId(hosteller.id);
    const { error } = await supabase.from('hostellers')
      .update({ approval_status: 'approved' })
      .eq('id', hosteller.id);
    if (error) { toast.error('Failed to approve'); setActionId(null); return; }
    await createNotification(
      hosteller.id, 'hosteller', 'general',
      'Your registration has been approved! Welcome to the hostel.'
    );
    toast.success(`${hosteller.name} approved`);
    setActionId(null);
    load();
  }

  async function handleReject(hosteller: Hosteller) {
    setActionId(hosteller.id + '_reject');
    const { error } = await supabase.from('hostellers')
      .update({ approval_status: 'rejected' })
      .eq('id', hosteller.id);
    if (error) { toast.error('Failed to reject'); setActionId(null); return; }
    await createNotification(
      hosteller.id, 'hosteller', 'general',
      'Your registration request has been declined. Please contact the hostel office for more information.'
    );
    toast.success(`${hosteller.name} rejected`);
    setActionId(null);
    load();
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Pending Approvals</h1>
        <p className="text-sm text-slate-500">{rows.length} hosteller{rows.length !== 1 ? 's' : ''} waiting for approval</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle size={40} className="text-emerald-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">All caught up!</p>
          <p className="text-sm text-slate-400 mt-1">No pending approvals at this time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ hosteller, room }) => (
            <div key={hosteller.id} className="card p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-base font-bold text-amber-700">
                    {hosteller.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-slate-900">{hosteller.name}</h3>
                      <span className="badge-yellow mt-1">Pending Approval</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{hosteller.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={13} className="text-slate-400 flex-shrink-0" />
                      <span>{hosteller.phone || '—'}</span>
                    </div>
                    {room && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={13} className="text-slate-400 flex-shrink-0" />
                        <span>Room {room.room_number} · {room.room_type.toUpperCase()} · {room.sharing_type}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar size={13} className="text-slate-400 flex-shrink-0" />
                      <span>Move-in: {formatDate(hosteller.move_in_date)}</span>
                    </div>
                    {hosteller.aadhar_number && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <User size={13} className="text-slate-400 flex-shrink-0" />
                        <span>Aadhaar: XXXX XXXX {hosteller.aadhar_number.slice(-4)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleApprove(hosteller)}
                  disabled={!!actionId}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {actionId === hosteller.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  Approve
                </button>
                <button
                  onClick={() => handleReject(hosteller)}
                  disabled={!!actionId}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium rounded-lg border border-red-200 transition-colors disabled:opacity-50"
                >
                  {actionId === hosteller.id + '_reject' ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
