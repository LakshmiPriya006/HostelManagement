'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Megaphone, Clock, Send, Loader2, Calendar } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../src/services/supabase';
import { useHostelStore } from '../../../src/store/hostelStore';
import { useAuthStore } from '../../../src/store/authStore';
import Modal from '../../../src/components/shared/Modal';
import ConfirmModal from '../../../src/components/shared/ConfirmModal';
import EmptyState from '../../../src/components/shared/EmptyState';
import { formatDate, timeAgo } from '../../../src/utils';
import { sendAnnouncementNotification } from '../../../src/services/notifications';
import toast from 'react-hot-toast';
import type { Announcement } from '../../../src/types';

const schema = z.object({
  title: z.string().min(3, 'Title required'),
  content: z.string().min(10, 'Content required (min 10 chars)'),
  isScheduled: z.boolean().default(false),
  scheduled_at: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const BG_COLORS = [
  'from-primary-500 to-primary-700',
  'from-emerald-500 to-emerald-700',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-rose-700',
  'from-cyan-500 to-cyan-700',
  'from-violet-500 to-violet-700',
];

export default function Announcements() {
  const { selectedHostelId } = useHostelStore();
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isScheduled: false },
  });
  const isScheduled = watch('isScheduled');

  const load = useCallback(async () => {
    if (!selectedHostelId) return;
    setLoading(true);
    const { data } = await supabase.from('announcements').select('*').eq('hostel_id', selectedHostelId).order('created_at', { ascending: false });
    setAnnouncements(data || []);
    setLoading(false);
  }, [selectedHostelId]);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(data: FormData) {
    if (!user || !selectedHostelId) return;
    setSubmitting(true);
    try {
      const { data: ann, error } = await supabase.from('announcements').insert({
        hostel_id: selectedHostelId,
        owner_id: user.id,
        title: data.title,
        content: data.content,
        scheduled_at: data.isScheduled && data.scheduled_at ? data.scheduled_at : null,
      }).select().single();
      if (error) throw error;

      if (!data.isScheduled) {
        const { data: hostellers } = await supabase.from('hostellers').select('id').eq('hostel_id', selectedHostelId).eq('status', 'active');
        if (hostellers && hostellers.length > 0) {
          await sendAnnouncementNotification(hostellers.map((h: any) => h.id), ann.id, data.title);
        }
      }

      toast.success(data.isScheduled ? 'Announcement scheduled' : 'Announcement sent');
      reset();
      setShowCreate(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('announcements').delete().eq('id', deleteId);
    toast.success('Announcement deleted');
    setDeleteId(null);
    load();
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Announcements</h1>
          <p className="section-subtitle">{announcements.length} total announcements</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> New Announcement
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" description="Create your first announcement to notify hostellers." action={{ label: 'Create Announcement', onClick: () => setShowCreate(true) }} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {announcements.map((ann, idx) => {
            const gradient = BG_COLORS[idx % BG_COLORS.length];
            const isExpanded = expanded === ann.id;
            return (
              <div
                key={ann.id}
                className="card overflow-hidden flex flex-col hover:shadow-card-md transition-shadow duration-200 cursor-pointer group"
                onClick={() => setExpanded(isExpanded ? null : ann.id)}
              >
                <div className={`bg-gradient-to-br ${gradient} px-5 pt-5 pb-4 relative`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                      {ann.scheduled_at ? <Calendar size={16} className="text-white" /> : <Send size={16} className="text-white" />}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteId(ann.id); }}
                      className="p-1.5 text-white/60 hover:text-white hover:bg-white/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <h3 className="font-bold text-white mt-3 text-base leading-snug line-clamp-2">{ann.title}</h3>
                  {ann.scheduled_at ? (
                    <span className="inline-flex items-center gap-1 mt-2 text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium">
                      <Clock size={10} /> Scheduled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 mt-2 text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium">
                      <Send size={10} /> Sent
                    </span>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <p className={`text-sm text-ink-600 leading-relaxed flex-1 ${isExpanded ? '' : 'line-clamp-3'}`}>
                    {ann.content}
                  </p>
                  {ann.content.length > 120 && (
                    <span className="text-xs text-primary-600 font-medium mt-1">
                      {isExpanded ? 'Show less' : 'Read more'}
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-ink-100">
                    <Clock size={11} className="text-ink-300" />
                    <p className="text-xs text-ink-400">
                      {ann.scheduled_at ? `Scheduled for ${formatDate(ann.scheduled_at)}` : timeAgo(ann.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); reset(); }} title="New Announcement">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input {...register('title')} className="input" placeholder="e.g., Water supply disruption on Sunday" />
            {errors.title && <p className="text-danger-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label">Content *</label>
            <textarea {...register('content')} rows={4} className="input resize-none" placeholder="Write your announcement here..." />
            {errors.content && <p className="text-danger-500 text-xs mt-1">{errors.content.message}</p>}
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('isScheduled')} className="w-4 h-4 text-primary-600 rounded" />
              <span className="text-sm font-medium text-ink-700">Schedule for later</span>
            </label>
            {isScheduled && (
              <div className="mt-2">
                <label className="label">Schedule Date &amp; Time</label>
                <input {...register('scheduled_at')} type="datetime-local" className="input" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowCreate(false); reset(); }} className="btn-secondary text-sm" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary flex items-center gap-2 text-sm" disabled={submitting}>
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {isScheduled ? 'Schedule' : 'Send Now'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Announcement"
        message="Are you sure you want to delete this announcement? This cannot be undone."
        confirmLabel="Delete"
        isDestructive
      />
    </div>
  );
}
