'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/store/authStore';
import Modal from '../../../src/components/shared/Modal';
import EmptyState from '../../../src/components/shared/EmptyState';
import { timeAgo } from '../../../src/utils';
import toast from 'react-hot-toast';
import type { Problem } from '../../../src/types';

const schema = z.object({
  title: z.string().min(3, 'Title required'),
  description: z.string().min(10, 'Please describe the problem (min 10 chars)'),
});

type FormData = z.infer<typeof schema>;

const STATUS_BADGE: Record<string, JSX.Element> = {
  open: <span className="badge-yellow">Open</span>,
  in_progress: <span className="badge-blue">In Progress</span>,
  resolved: <span className="badge-green">Resolved</span>,
};

export default function HostellerProblems() {
  const { hostellerProfile } = useAuthStore();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const load = useCallback(async () => {
    if (!hostellerProfile) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from('problems').select('*').eq('hosteller_id', hostellerProfile.id).order('created_at', { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setProblems(data || []);
    setLoading(false);
  }, [hostellerProfile]);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(data: FormData) {
    if (!hostellerProfile) return;
    setSubmitting(true);
    const { error } = await supabase.from('problems').insert({
      hosteller_id: hostellerProfile.id,
      hostel_id: hostellerProfile.hostel_id,
      title: data.title,
      description: data.description,
      status: 'open',
    });
    if (error) { toast.error('Failed to submit problem'); }
    else {
      toast.success('Problem reported to management');
      reset();
      setShowReport(false);
      load();
    }
    setSubmitting(false);
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Problems</h1>
          <p className="text-sm text-slate-500">Report maintenance issues or complaints</p>
        </div>
        <button onClick={() => setShowReport(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Report Problem
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Failed to load problems</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : error ? null : problems.length === 0 ? (
        <EmptyState icon={AlertCircle} title="No problems reported" description="Report any maintenance issues or complaints here." action={{ label: 'Report a Problem', onClick: () => setShowReport(true) }} />
      ) : (
        <div className="space-y-3">
          {problems.map(p => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900">{p.title}</h3>
                    {STATUS_BADGE[p.status]}
                  </div>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{p.description}</p>
                  <p className="text-xs text-slate-400 mt-2">Reported {timeAgo(p.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showReport} onClose={() => { setShowReport(false); reset(); }} title="Report a Problem">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Problem Title *</label>
            <input {...register('title')} className="input" placeholder="e.g., Water heater not working" />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label">Description *</label>
            <textarea {...register('description')} rows={4} className="input resize-none" placeholder="Describe the problem in detail..." />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setShowReport(false); reset(); }} className="btn-secondary text-sm" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary flex items-center gap-2 text-sm" disabled={submitting}>
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Submit Report
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
