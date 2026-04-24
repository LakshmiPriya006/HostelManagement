'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Send, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/store/authStore';
import Modal from '../../../src/components/shared/Modal';
import EmptyState from '../../../src/components/shared/EmptyState';
import { timeAgo } from '../../../src/utils';
import toast from 'react-hot-toast';
import type { FeedbackForm, FeedbackQuestion, FeedbackResponse } from '../../../src/types';

export default function HostellerFeedback() {
  const { hostellerProfile } = useAuthStore();
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [submissions, setSubmissions] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFill, setActiveFill] = useState<FeedbackForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!hostellerProfile) return;
    setLoading(true);
    setError(null);
    const [formRes, subRes] = await Promise.all([
      supabase.from('feedback_forms').select('*').eq('hostel_id', hostellerProfile.hostel_id).order('created_at', { ascending: false }),
      supabase.from('feedback_responses').select('*').eq('hosteller_id', hostellerProfile.id),
    ]);
    if (formRes.error) setError(formRes.error.message);
    else {
      setForms((formRes.data || []).map((f: any) => ({ ...f, questions: f.questions || [] })));
      setSubmissions(subRes.data || []);
    }
    setLoading(false);
  }, [hostellerProfile]);

  useEffect(() => { load(); }, [load]);

  function hasSubmitted(formId: string) {
    return submissions.some(s => s.form_id === formId);
  }

  function startFill(form: FeedbackForm) {
    setActiveFill(form);
    setAnswers({});
  }

  async function submitFeedback() {
    if (!hostellerProfile || !activeFill) return;
    const unanswered = activeFill.questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) { toast.error('Please answer all questions'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('feedback_responses').insert({
      form_id: activeFill.id,
      hosteller_id: hostellerProfile.id,
      answers,
    });
    if (error) { toast.error('Failed to submit feedback'); }
    else {
      toast.success('Feedback submitted!');
      setActiveFill(null);
      setAnswers({});
      load();
    }
    setSubmitting(false);
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Feedback</h1>
        <p className="text-sm text-slate-500">Share your experience and help improve the hostel</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Failed to load feedback forms</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : error ? null : forms.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No feedback forms" description="Your hostel hasn't created any feedback forms yet." />
      ) : (
        <div className="space-y-3">
          {forms.map(form => (
            <div key={form.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
                    {hasSubmitted(form.id) ? <CheckCircle size={16} className="text-emerald-600" /> : <MessageSquare size={16} className="text-primary-600" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{form.title}</p>
                    <p className="text-xs text-slate-400">{form.questions.length} questions • {timeAgo(form.created_at)}</p>
                  </div>
                </div>
                {hasSubmitted(form.id) ? (
                  <span className="badge-green">Submitted</span>
                ) : (
                  <button onClick={() => startFill(form)} className="btn-primary text-sm">Fill Form</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fill Feedback Modal */}
      <Modal isOpen={!!activeFill} onClose={() => setActiveFill(null)} title={activeFill?.title || ''} size="md">
        <div className="space-y-4">
          {activeFill?.questions.map((q: FeedbackQuestion) => (
            <div key={q.id}>
              <label className="label">{q.question}</label>
              {q.type === 'text' && (
                <textarea value={(answers[q.id] as string) || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  rows={3} className="input resize-none" placeholder="Your answer..." />
              )}
              {q.type === 'rating' && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setAnswers(prev => ({ ...prev, [q.id]: n }))}
                      className={`w-10 h-10 rounded-lg border-2 font-semibold text-sm transition-colors ${answers[q.id] === n ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {q.type === 'multiple_choice' && (
                <div className="space-y-2">
                  {q.options?.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                      <input type="radio" name={q.id} value={opt} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} checked={answers[q.id] === opt} className="w-4 h-4 text-primary-600" />
                      <span className="text-sm text-slate-700">{opt}</span>
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
