'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Search, Filter, Send, Check, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { useHostelStore } from '../../../src/store/hostelStore';
import { TableSkeleton } from '../../../src/components/shared/LoadingSkeleton';
import { formatCurrency, getMonthName, getCurrentMonth, getCurrentYear } from '../../../src/utils';
import { sendRentReminder } from '../../../src/services/notifications';
import toast from 'react-hot-toast';
import type { RentPayment, Hosteller, Room, Floor } from '../../../src/types';

interface RentRow {
  hosteller: Hosteller;
  room: Room | undefined;
  floor: Floor | undefined;
  rent: RentPayment | null;
}

export default function RentTracker() {
  const { selectedHostelId } = useHostelStore();
  const [rows, setRows] = useState<RentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [floors, setFloors] = useState<Floor[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const currentMonth = getCurrentMonth();
  const currentYear = getCurrentYear();

  const load = useCallback(async () => {
    if (!selectedHostelId) return;
    setLoading(true);
    try {
      const [hosRes, roomRes, floorRes, rentRes] = await Promise.all([
        supabase.from('hostellers').select('*').eq('hostel_id', selectedHostelId).eq('status', 'active'),
        supabase.from('rooms').select('*').eq('hostel_id', selectedHostelId),
        supabase.from('floors').select('*').eq('hostel_id', selectedHostelId).order('floor_number'),
        supabase.from('rent_payments').select('*').eq('hostel_id', selectedHostelId)
          .eq('month', currentMonth).eq('year', currentYear),
      ]);
      const hostellers: Hosteller[] = hosRes.data || [];
      const rooms: Room[] = roomRes.data || [];
      const floorsData: Floor[] = floorRes.data || [];
      const rents: RentPayment[] = rentRes.data || [];
      setFloors(floorsData);

      // Create rent records for hostellers who don't have one
      const missingRents = hostellers.filter(h => h.room_id && !rents.find(r => r.hosteller_id === h.id));
      if (missingRents.length > 0) {
        const toInsert = missingRents.map(h => {
          const room = rooms.find(r => r.id === h.room_id);
          return {
            hosteller_id: h.id,
            hostel_id: selectedHostelId,
            room_id: h.room_id!,
            month: currentMonth,
            year: currentYear,
            amount: room?.rent_amount || 0,
            fine_amount: 0,
            status: 'unpaid',
            payment_mode: 'upi',
          };
        });
        const { data: newRents } = await supabase.from('rent_payments').insert(toInsert).select();
        if (newRents) rents.push(...(newRents as RentPayment[]));
      }

      const built: RentRow[] = hostellers.map(h => {
        const room = rooms.find(r => r.id === h.room_id);
        const floor = floorsData.find(f => f.id === room?.floor_id);
        const rent = rents.find(r => r.hosteller_id === h.id) || null;
        return { hosteller: h, room, floor, rent };
      });
      setRows(built);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedHostelId, currentMonth, currentYear]);

  useEffect(() => { load(); }, [load]);

  async function markAsPaid(row: RentRow) {
    if (!row.rent) return;
    setMarkingId(row.hosteller.id);
    const { error } = await supabase.from('rent_payments').update({
      status: 'paid',
      payment_mode: row.rent.status === 'pending' ? row.rent.payment_mode : 'cash',
      paid_at: new Date().toISOString(),
      marked_by_owner: true,
    }).eq('id', row.rent.id);
    if (error) { toast.error('Failed to mark as paid'); }
    else { toast.success(`${row.hosteller.name} marked as paid`); load(); }
    setMarkingId(null);
  }

  async function rejectPayment(row: RentRow) {
    if (!row.rent) return;
    setMarkingId(row.hosteller.id);
    const { error } = await supabase.from('rent_payments').update({
      status: 'unpaid',
      paid_at: null,
    }).eq('id', row.rent.id);

    if (error) {
      toast.error('Failed to reject payment');
    } else {
      // Notify hosteller
      await supabase.from('notifications').insert({
        user_id: row.hosteller.id,
        user_role: 'hosteller',
        type: 'rent_rejected',
        message: `Your rent payment verification for ${getMonthName(currentMonth)} was rejected by the owner. Please contact them or try again.`,
      });
      toast.success('Payment rejected');
      load();
    }
    setMarkingId(null);
  }

  async function sendReminder(hosteller: Hosteller) {
    const { error } = await sendRentReminder([hosteller.id], `Reminder: Your rent for ${getMonthName(currentMonth)} is due.`);
    if (error) toast.error('Failed to send reminder');
    else toast.success(`Reminder sent to ${hosteller.name}`);
  }

  async function bulkRemind() {
    const unpaidRows = filtered.filter(r => r.rent?.status !== 'paid');
    if (unpaidRows.length === 0) { toast.error('No unpaid hostellers to remind'); return; }
    setBulkLoading(true);
    const ids = unpaidRows.map(r => r.hosteller.id);
    const { error } = await sendRentReminder(ids, `Reminder: Your rent for ${getMonthName(currentMonth)} ${currentYear} is due. Please pay at the earliest.`);
    if (error) toast.error('Failed to send reminders');
    else toast.success(`Reminders sent to ${ids.length} hostellers`);
    setBulkLoading(false);
  }

  const filtered = rows.filter(row => {
    const matchSearch = !search || row.hosteller.name.toLowerCase().includes(search.toLowerCase()) ||
      (row.room?.room_number || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || row.rent?.status === statusFilter || (!row.rent && statusFilter === 'unpaid');
    const matchFloor = floorFilter === 'all' || row.floor?.id === floorFilter;
    return matchSearch && matchStatus && matchFloor;
  });

  const totalExpected = rows.reduce((s, r) => s + (r.rent?.amount || 0) + (r.rent?.fine_amount || 0), 0);
  const totalCollected = rows.filter(r => r.rent?.status === 'paid').reduce((s, r) => s + (r.rent?.amount || 0), 0);
  const unpaidCount = rows.filter(r => !r.rent || r.rent.status === 'unpaid').length;
  const overdueCount = rows.filter(r => r.rent?.status === 'overdue').length;

  const statusBadge = (status?: string) => {
    if (status === 'paid') return <span className="badge-green">Paid</span>;
    if (status === 'pending') return <span className="badge-blue">Pending</span>;
    if (status === 'overdue') return <span className="badge-red">Overdue</span>;
    return <span className="badge-yellow">Unpaid</span>;
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Rent Tracker</h1>
          <p className="text-sm text-slate-500">{getMonthName(currentMonth)} {currentYear}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary text-sm p-2" title="Refresh"><RefreshCw size={16} /></button>
          <button onClick={bulkRemind} disabled={bulkLoading} className="btn-secondary flex items-center gap-2 text-sm">
            {bulkLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Bulk Remind
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Expected', value: formatCurrency(totalExpected), color: 'text-slate-800' },
          { label: 'Collected', value: formatCurrency(totalCollected), color: 'text-emerald-600' },
          { label: 'Unpaid', value: unpaidCount, color: 'text-amber-600' },
          { label: 'Overdue', value: overdueCount, color: 'text-red-600' },
        ].map((s, i) => (
          <div key={i} className="card p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or room..." className="input pl-9 text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-sm w-36">
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="unpaid">Unpaid</option>
          <option value="overdue">Overdue</option>
        </select>
        <select value={floorFilter} onChange={e => setFloorFilter(e.target.value)} className="input text-sm w-36">
          <option value="all">All Floors</option>
          {floors.map(f => <option key={f.id} value={f.id}>Floor {f.floor_number}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? <TableSkeleton /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Hosteller</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Room</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Rent</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Fine</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Total</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Mode</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400">No records found</td></tr>
                ) : filtered.map(row => (
                  <tr key={row.hosteller.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{row.hosteller.name}</div>
                      <div className="text-xs text-slate-400">{row.hosteller.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{row.room?.room_number || '—'}</div>
                      <div className="text-xs text-slate-400">Floor {row.floor?.floor_number || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.rent?.amount || 0)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(row.rent?.fine_amount || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatCurrency((row.rent?.amount || 0) + (row.rent?.fine_amount || 0))}
                    </td>
                    <td className="px-4 py-3 text-center">{statusBadge(row.rent?.status)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="badge-gray uppercase">{row.rent?.payment_mode || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.rent?.status === 'pending' && (
                          <>
                            <button onClick={() => markAsPaid(row)} disabled={markingId === row.hosteller.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors">
                              {markingId === row.hosteller.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                              Approve
                            </button>
                            <button onClick={() => rejectPayment(row)} disabled={markingId === row.hosteller.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 rounded-md transition-colors">
                              Reject
                            </button>
                          </>
                        )}
                        {row.rent?.status !== 'paid' && row.rent?.status !== 'pending' && (
                          <>
                            <button onClick={() => markAsPaid(row)} disabled={markingId === row.hosteller.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors">
                              {markingId === row.hosteller.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                              Mark Paid
                            </button>
                            <button onClick={() => sendReminder(row.hosteller)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md transition-colors">
                              <Send size={11} /> Remind
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
