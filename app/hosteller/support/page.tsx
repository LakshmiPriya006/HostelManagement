'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, AlertCircle, MessageSquare, Loader2, CheckCircle, Clock, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/store/authStore';
import Modal from '../../../src/components/shared/Modal';
import EmptyState from '../../../src/components/shared/EmptyState';
import { timeAgo } from '../../../src/utils';
import toast from 'react-hot-toast';
import type { Problem, FeedbackForm, FeedbackQuestion, FeedbackResponse } from '../../../src/types';

const problemSchema = z.object({
  title: z.string().min(3, 'Title required'),
  description: z.string().min(10, 'Please describe the problem (min 10 chars)'),
});
type ProblemFormData = z.infer<typeof problemSchema>;

const STATUS_BADGE: Record<string, React.ReactNode> = {
  open: <span className="badge-yellow">Open</span>,
  in_progress: <span className="badge-blue">In Progress</span>,
  resolved: <span className="badge-green">Resolved</span>,
};

export default function HostellerSupport() {
  const { hostellerProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'problems' | 'feedback'>('problems');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [submissions, setSubmissions] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeFill, setActiveFill] = useState<FeedbackForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProblemFormData>({
    resolver: zodResolver(problemSchema),
  });

  const load = useCallback(async () => {
    if (!hostellerProfile) return;
    setLoading(true);
    const [probRes, formRes, subRes] = await Promise.all([
      supabase.from('problems').select('*').eq('hosteller_id', hostellerProfile.id).order('created_at', { ascending: false }),
      supabase.from('feedback_forms').select('*').eq('hostel_id', hostellerProfile.hostel_id).order('created_at', { ascending: false }),
      supabase.from('feedback_responses').select('*').eq('hosteller_id', hostellerProfile.id),
    ]);
    setProblems(probRes.data || []);
    setForms((formRes.data || []).map((f: any) => ({ ...f, questions: f.questions || [] })));
    setSubmissions(subRes.data || []);
    setLoading(false);
  }, [hostellerProfile]);

  useEffect(() => { load(); }, [load]);

  async function onSubmitProblem(data: ProblemFormData) {
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
    else { toast.success('Problem reported to management'); reset(); setShowReport(false); load(); }
    setSubmitting(false);
  }

  async function submitFeedback() {
    if (!hostellerProfile || !activeFill) return;
    const unanswered = activeFill.questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) { toast.error('Please answer all questions'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('feedback_responses').insert({
      form_id: activeFill.id, hosteller_id: hostellerProfile.id, answers,
    });
    if (error) { toast.error('Failed to submit feedback'); }
    else { toast.success('Feedback submitted!'); setActiveFill(null); setAnswers({}); load(); }
    setSubmitting(false);
  }

  const hasSubmitted = (formId: string) => submissions.some(s => s.form_id === formId);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Problems & Feedback</h1>
          <p className="section-subtitle">Report issues and share your experience</p>
        </div>
        {activeTab === 'problems' && (
          <button onClick={() => setShowReport(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Report Problem
          </button>
        )}
      </div>

      <div className="tab-bar">
        <button onClick={() => setActiveTab('problems')} className={`tab-item flex items-center gap-2 ${activeTab === 'problems' ? 'tab-item-active' : 'tab-item-inactive'}`}>
          <AlertCircle size={14} /> Problems
          {problems.filter(p => p.status !== 'resolved').length > 0 && (
            <span className="bg-warning-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {problems.filter(p => p.status !== 'resolved').length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('feedback')} className={`tab-item flex items-center gap-2 ${activeTab === 'feedback' ? 'tab-item-active' : 'tab-item-inactive'}`}>
          <MessageSquare size={14} /> Feedback
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : activeTab === 'problems' ? (
        problems.length === 0 ? (
          <EmptyState icon={AlertCircle} title="No problems reported" description="Report any maintenance issues or complaints here." action={{ label: 'Report a Problem', onClick: () => setShowReport(true) }} />
        ) : (
          <div className="space-y-3">
            {problems.map(p => (
              <div key={p.id} className="card p-4 hover:shadow-card-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.status === 'resolved' ? 'bg-success-100' : p.status === 'in_progress' ? 'bg-primary-100' : 'bg-warning-100'}`}>
                    {p.status === 'resolved' ? <CheckCircle size={18} className="text-success-600" /> : p.status === 'in_progress' ? <Clock size={18} className="text-primary-600" /> : <AlertCircle size={18} className="text-warning-600" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-ink-900">{p.title}</h3>
                      {STATUS_BADGE[p.status]}
                    </div>
                    <p className="text-sm text-ink-500 leading-relaxed">{p.description}</p>
                    <p className="text-xs text-ink-400 mt-2">Reported {timeAgo(p.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        forms.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No feedback forms" description="Your hostel hasn't created any feedback forms yet." />
        ) : (
          <div className="space-y-3">
            {forms.map(form => (
              <div key={form.id} className="card p-4 hover:shadow-card-md transition-shadow">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${hasSubmitted(form.id) ? 'bg-success-100' : 'bg-amber-100'}`}>
                      {hasSubmitted(form.id) ? <CheckCircle size={18} className="text-success-600" /> : <MessageSquare size={18} className="text-amber-600" />}
                    </div>
                    <div>
                      <p className="font-semibold text-ink-800">{form.title}</p>
                      <p className="text-xs text-ink-400">{form.questions.length} questions · {timeAgo(form.created_at)}</p>
                    </div>
                  </div>
                  {hasSubmitted(form.id) ? (
                    <span className="badge-green">Submitted</span>
                  ) : (
                    <button onClick={() => { setActiveFill(form); setAnswers({}); }} className="btn-primary text-xs px-3 py-1.5">Fill Form</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Report Problem Modal */}
      <Modal isOpen={showReport} onClose={() => { setShowReport(false); reset(); }} title="Report a Problem">
        <form onSubmit={handleSubmit(onSubmitProblem)} className="space-y-4">
          <div>
            <label className="label">Problem Title *</label>
            <input {...register('title')} className="input" placeholder="e.g., Water heater not working" />
            {errors.title && <p className="text-danger-500 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label">Description *</label>
            <textarea {...register('description')} rows={4} className="input resize-none" placeholder="Describe the problem in detail..." />
            {errors.description && <p className="text-danger-500 text-xs mt-1">{errors.description.message}</p>}
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

      {/* Fill Feedback Modal */}
      <Modal isOpen={!!activeFill} onClose={() => setActiveFill(null)} title={activeFill?.title || ''} size="md">
        <div className="space-y-4">
          {activeFill?.questions.map((q: FeedbackQuestion) => (
            <div key={q.id}>
              <label className="label">{q.question}</label>
              {q.type === 'text' && (
                <textarea value={(answers[q.id] as string) || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} rows={3} className="input resize-none" placeholder="Your answer..." />
              )}
              {q.type === 'rating' && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setAnswers(prev => ({ ...prev, [q.id]: n }))}
                      className={`w-10 h-10 rounded-xl border-2 font-bold text-sm transition-all ${answers[q.id] === n ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-ink-200 text-ink-500 hover:border-ink-300'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {q.type === 'multiple_choice' && (
                <div className="space-y-2">
                  {q.options?.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl hover:bg-ink-50 border border-ink-100">
                      <input type="radio" name={q.id} value={opt} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} checked={answers[q.id] === opt} className="w-4 h-4 text-primary-600" />
                      <span className="text-sm text-ink-700">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setActiveFill(null)} className="btn-secondary text-sm" disabled={submitting}>Cancel</button>
            <button onClick={submitFeedback} className="btn-primary flex items-center gap-2 text-sm" disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit Feedback
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
