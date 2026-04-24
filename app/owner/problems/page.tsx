'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { useHostelStore } from '../../../src/store/hostelStore';
import { TableSkeleton } from '../../../src/components/shared/LoadingSkeleton';
import EmptyState from '../../../src/components/shared/EmptyState';
import { timeAgo } from '../../../src/utils';
import toast from 'react-hot-toast';
import type { Problem, Hosteller, Room } from '../../../src/types';

interface ProblemRow {
  problem: Problem;
  hosteller: Hosteller | undefined;
  room: Room | undefined;
}

const STATUS_NEXT: Record<string, string> = { open: 'in_progress', in_progress: 'resolved', resolved: 'open' };
const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

export default function Problems() {
  const { selectedHostelId } = useHostelStore();
  const [rows, setRows] = useState<ProblemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    if (!selectedHostelId) return;
    setLoading(true);
    const [problemRes, hosRes, roomRes] = await Promise.all([
      supabase.from('problems').select('*').eq('hostel_id', selectedHostelId).order('created_at', { ascending: false }),
      supabase.from('hostellers').select('*').eq('hostel_id', selectedHostelId),
      supabase.from('rooms').select('*').eq('hostel_id', selectedHostelId),
    ]);
    const problems: Problem[] = problemRes.data || [];
    const hostellers: Hosteller[] = hosRes.data || [];
    const rooms: Room[] = roomRes.data || [];
    setRows(problems.map(p => ({
      problem: p,
      hosteller: hostellers.find(h => h.id === p.hosteller_id),
      room: rooms.find(r => r.id === hostellers.find(h => h.id === p.hosteller_id)?.room_id),
    })));
    setLoading(false);
  }, [selectedHostelId]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(problem: Problem, newStatus: string) {
    const { error } = await supabase.from('problems').update({ status: newStatus }).eq('id', problem.id);
    if (error) { toast.error('Failed to update status'); return; }

    // Notify hosteller
    await supabase.from('notifications').insert({
      user_id: problem.hosteller_id,
      user_role: 'hosteller',
      type: 'problem_update',
      message: `Your problem "${problem.title}" is now ${STATUS_LABEL[newStatus]}.`,
      reference_id: problem.id,
    });

    toast.success(`Status updated to ${STATUS_LABEL[newStatus]}`);
    load();
  }

  const filtered = rows.filter(r => statusFilter === 'all' || r.problem.status === statusFilter);

  const statusBadge = (status: string) => {
    if (status === 'resolved') return <span className="badge-green">Resolved</span>;
    if (status === 'in_progress') return <span className="badge-blue">In Progress</span>;
    return <span className="badge-yellow">Open</span>;
  };

  const counts = {
    all: rows.length,
    open: rows.filter(r => r.problem.status === 'open').length,
    in_progress: rows.filter(r => r.problem.status === 'in_progress').length,
    resolved: rows.filter(r => r.problem.status === 'resolved').length,
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Problems</h1>
        <p className="text-sm text-slate-500">{counts.open} open, {counts.in_progress} in progress</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {Object.entries({ all: 'All', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' }).map(([val, label]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === val ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {label} ({counts[val as keyof typeof counts]})
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton /> : filtered.length === 0 ? (
        <EmptyState icon={AlertCircle} title="No problems found" description="No problems match the current filter." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Hosteller</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Room</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Problem</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Reported</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(({ problem, hosteller, room }) => (
                  <tr key={problem.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{hosteller?.name || 'Unknown'}</div>
                      <div className="text-xs text-slate-400">{hosteller?.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{room?.room_number || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{problem.title}</div>
                      <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{problem.description}</div>
                    </td>
                    <td className="px-4 py-3 text-center">{statusBadge(problem.status)}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400">{timeAgo(problem.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {problem.status !== 'resolved' && (
                        <button
                          onClick={() => updateStatus(problem, STATUS_NEXT[problem.status])}
                          className="text-xs px-2.5 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-md font-medium transition-colors"
                        >
                          &rarr; {STATUS_LABEL[STATUS_NEXT[problem.status]]}
                        </button>
                      )}
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
