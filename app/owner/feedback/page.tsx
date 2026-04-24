'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, MessageSquare, Eye, Send, Loader2 } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { useHostelStore } from '../../../src/store/hostelStore';
import { useAuthStore } from '../../../src/store/authStore';
import Modal from '../../../src/components/shared/Modal';
import EmptyState from '../../../src/components/shared/EmptyState';
import { timeAgo } from '../../../src/utils';
import { sendFeedbackNotification } from '../../../src/services/notifications';
import toast from 'react-hot-toast';
import type { FeedbackForm, FeedbackQuestion, FeedbackResponse, Hosteller } from '../../../src/types';

export default function Feedback() {
  const { selectedHostelId } = useHostelStore();
  const { user } = useAuthStore();
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewForm, setViewForm] = useState<FeedbackForm | null>(null);
  const [responses, setResponses] = useState<(FeedbackResponse & { hosteller?: Hosteller })[]>([]);
  const [formTitle, setFormTitle] = useState('');
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!selectedHostelId) return;
    setLoading(true);
    const { data } = await supabase.from('feedback_forms').select('*').eq('hostel_id', selectedHostelId).order('created_at', { ascending: false });
    setForms((data || []).map((f: any) => ({ ...f, questions: f.questions || [] })));
    setLoading(false);
  }, [selectedHostelId]);

  useEffect(() => { load(); }, [load]);

  function addQuestion(type: 'text' | 'rating' | 'multiple_choice') {
    const q: FeedbackQuestion = {
      id: Date.now().toString(),
      type,
      question: '',
      options: type === 'multiple_choice' ? ['Option 1', 'Option 2'] : undefined,
    };
    setQuestions(prev => [...prev, q]);
  }

  function updateQuestion(id: string, updates: Partial<FeedbackQuestion>) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id));
  }

  async function createForm() {
    if (!user || !selectedHostelId || !formTitle.trim() || questions.length === 0) {
      toast.error('Please add a title and at least one question');
      return;
    }
    setSubmitting(true);
    try {
      const { data: form, error } = await supabase.from('feedback_forms').insert({
        hostel_id: selectedHostelId,
        owner_id: user.id,
        title: formTitle,
        questions,
      }).select().single();
      if (error) throw error;

      const { data: hostellers } = await supabase.from('hostellers').select('id').eq('hostel_id', selectedHostelId).eq('status', 'active');
      if (hostellers && hostellers.length > 0) {
        await sendFeedbackNotification(hostellers.map((h: any) => h.id), form.id, formTitle);
      }

      toast.success('Feedback form created and sent to hostellers');
      setShowCreate(false);
      setFormTitle('');
      setQuestions([]);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function viewResponses(form: FeedbackForm) {
    setViewForm(form);
    const { data } = await supabase.from('feedback_responses').select('*').eq('form_id', form.id);
    const respData: FeedbackResponse[] = data || [];
    const hostellerIds = [...new Set(respData.map(r => r.hosteller_id))];
    let hostellers: Hosteller[] = [];
    if (hostellerIds.length > 0) {
      const { data: hData } = await supabase.from('hostellers').select('*').in('id', hostellerIds);
      hostellers = hData || [];
    }
    setResponses(respData.map(r => ({
      ...r,
      hosteller: hostellers.find(h => h.id === r.hosteller_id),
    })));
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Feedback</h1>
          <p className="text-sm text-slate-500">{forms.length} feedback forms</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Create Form
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : forms.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No feedback forms" description="Create feedback forms to gather insights from hostellers." action={{ label: 'Create Form', onClick: () => setShowCreate(true) }} />
      ) : (
        <div className="space-y-3">
          {forms.map(form => (
            <div key={form.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
                    <MessageSquare size={16} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{form.title}</p>
                    <p className="text-xs text-slate-400">{form.questions.length} questions &bull; Created {timeAgo(form.created_at)}</p>
                  </div>
                </div>
                <button onClick={() => viewResponses(form)} className="btn-secondary flex items-center gap-2 text-sm">
                  <Eye size={14} /> View Responses
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Form Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setFormTitle(''); setQuestions([]); }} title="Create Feedback Form" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">Form Title *</label>
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className="input" placeholder="e.g., Monthly Satisfaction Survey" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Questions</label>
              <div className="flex gap-2">
                {(['text', 'rating', 'multiple_choice'] as const).map(type => (
                  <button key={type} onClick={() => addQuestion(type)}
                    className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition-colors capitalize">
                    + {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {questions.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Add questions using the buttons above</p>}
              {questions.map((q, i) => (
                <div key={q.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded capitalize">{q.type.replace('_', ' ')}</span>
                    <button onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                  <input
                    value={q.question}
                    onChange={e => updateQuestion(q.id, { question: e.target.value })}
                    className="input text-sm mb-2"
                    placeholder={`Question ${i + 1}`}
                  />
                  {q.type === 'multiple_choice' && (
                    <div className="space-y-1">
                      {q.options?.map((opt, oi) => (
                        <div key={oi} className="flex gap-2">
                          <input
                            value={opt}
                            onChange={e => {
                              const opts = [...(q.options || [])];
                              opts[oi] = e.target.value;
                              updateQuestion(q.id, { options: opts });
                            }}
                            className="input text-xs py-1"
                            placeholder={`Option ${oi + 1}`}
                          />
                        </div>
                      ))}
                      <button onClick={() => updateQuestion(q.id, { options: [...(q.options || []), ''] })}
                        className="text-xs text-primary-600 hover:underline">+ Add option</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowCreate(false); setFormTitle(''); setQuestions([]); }} className="btn-secondary text-sm" disabled={submitting}>Cancel</button>
            <button onClick={createForm} className="btn-primary flex items-center gap-2 text-sm" disabled={submitting}>
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <Send size={14} /> Create &amp; Send
            </button>
          </div>
        </div>
      </Modal>

      {/* View Responses Modal */}
      <Modal isOpen={!!viewForm} onClose={() => setViewForm(null)} title={`Responses: ${viewForm?.title}`} size="xl">
        {responses.length === 0 ? (
          <p className="text-center text-slate-400 py-8">No responses yet</p>
        ) : (
          <div className="space-y-4">
            {responses.map(resp => (
              <div key={resp.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-700">{resp.hosteller?.name?.slice(0, 2).toUpperCase() || '?'}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-800">{resp.hosteller?.name || 'Anonymous'}</span>
                  <span className="text-xs text-slate-400 ml-auto">{timeAgo(resp.submitted_at)}</span>
                </div>
                <div className="space-y-2">
                  {viewForm?.questions.map(q => (
                    <div key={q.id} className="text-sm">
                      <span className="font-medium text-slate-700">{q.question}: </span>
                      <span className="text-slate-600">{String((resp.answers as any)[q.id] || '—')}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
