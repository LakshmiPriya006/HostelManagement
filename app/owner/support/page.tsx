'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, MessageSquare, Plus, Trash2, Eye, Send, Loader2, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { useHostelStore } from '../../../src/store/hostelStore';
import { useAuthStore } from '../../../src/store/authStore';
import Modal from '../../../src/components/shared/Modal';
import EmptyState from '../../../src/components/shared/EmptyState';
import { timeAgo } from '../../../src/utils';
import { sendFeedbackNotification } from '../../../src/services/notifications';
import toast from 'react-hot-toast';
import type { Problem, Hosteller, Room, FeedbackForm, FeedbackQuestion, FeedbackResponse } from '../../../src/types';

interface ProblemRow { problem: Problem; hosteller: Hosteller | undefined; room: Room | undefined; }

const STATUS_NEXT: Record<string, string> = { open: 'in_progress', in_progress: 'resolved', resolved: 'open' };
const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };

export default function SupportPage() {
  const { selectedHostelId } = useHostelStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'problems' | 'feedback'>('problems');

  // Problems state
  const [rows, setRows] = useState<ProblemRow[]>([]);
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Feedback state
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewForm, setViewForm] = useState<FeedbackForm | null>(null);
  const [responses, setResponses] = useState<(FeedbackResponse & { hosteller?: Hosteller })[]>([]);
  const [formTitle, setFormTitle] = useState('');
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadProblems = useCallback(async () => {
    if (!selectedHostelId) return;
    setProblemsLoading(true);
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
    setProblemsLoading(false);
  }, [selectedHostelId]);

  const loadFeedback = useCallback(async () => {
    if (!selectedHostelId) return;
    setFeedbackLoading(true);
    const { data } = await supabase.from('feedback_forms').select('*').eq('hostel_id', selectedHostelId).order('created_at', { ascending: false });
    setForms((data || []).map((f: any) => ({ ...f, questions: f.questions || [] })));
    setFeedbackLoading(false);
  }, [selectedHostelId]);

  useEffect(() => { loadProblems(); loadFeedback(); }, [loadProblems, loadFeedback]);

  async function updateStatus(problem: Problem, newStatus: string) {
    const { error } = await supabase.from('problems').update({ status: newStatus }).eq('id', problem.id);
    if (error) { toast.error('Failed to update status'); return; }
    await supabase.from('notifications').insert({
      user_id: problem.hosteller_id,
      user_role: 'hosteller',
      type: 'problem_update',
      message: `Your problem "${problem.title}" is now ${STATUS_LABEL[newStatus]}.`,
      reference_id: problem.id,
    });
    toast.success(`Status updated to ${STATUS_LABEL[newStatus]}`);
    loadProblems();
  }

  function addQuestion(type: 'text' | 'rating' | 'multiple_choice') {
    setQuestions(prev => [...prev, { id: Date.now().toString(), type, question: '', options: type === 'multiple_choice' ? ['Option 1', 'Option 2'] : undefined }]);
  }

  function updateQuestion(id: string, updates: Partial<FeedbackQuestion>) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  }

  async function createForm() {
    if (!user || !selectedHostelId || !formTitle.trim() || questions.length === 0) {
      toast.error('Please add a title and at least one question');
      return;
    }
    setSubmitting(true);
    try {
      const { data: form, error } = await supabase.from('feedback_forms').insert({
        hostel_id: selectedHostelId, owner_id: user.id, title: formTitle, questions,
      }).select().single();
      if (error) throw error;
      const { data: hostellers } = await supabase.from('hostellers').select('id').eq('hostel_id', selectedHostelId).eq('status', 'active');
      if (hostellers && hostellers.length > 0) await sendFeedbackNotification(hostellers.map((h: any) => h.id), form.id, formTitle);
      toast.success('Feedback form created and sent');
      setShowCreate(false);
      setFormTitle('');
      setQuestions([]);
      loadFeedback();
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
    setResponses(respData.map(r => ({ ...r, hosteller: hostellers.find(h => h.id === r.hosteller_id) })));
  }

  const filtered = rows.filter(r => statusFilter === 'all' || r.problem.status === statusFilter);
  const counts = {
    all: rows.length,
    open: rows.filter(r => r.problem.status === 'open').length,
    in_progress: rows.filter(r => r.problem.status === 'in_progress').length,
    resolved: rows.filter(r => r.problem.status === 'resolved').length,
  };

  const statusBadge = (status: string) => {
    if (status === 'resolved') return <span className="badge-green">Resolved</span>;
    if (status === 'in_progress') return <span className="badge-blue">In Progress</span>;
    return <span className="badge-yellow">Open</span>;
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Problems & Feedback</h1>
          <p className="section-subtitle">Manage resident issues and collect feedback</p>
        </div>
        {activeTab === 'feedback' && (
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Create Form
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide">Open Issues</p>
          <p className="text-2xl font-bold text-danger-600 mt-1">{counts.open}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide">In Progress</p>
          <p className="text-2xl font-bold text-primary-600 mt-1">{counts.in_progress}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide">Resolved</p>
          <p className="text-2xl font-bold text-success-600 mt-1">{counts.resolved}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-400 font-semibold uppercase tracking-wide">Feedback Forms</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{forms.length}</p>
        </div>
      </div>

      <div className="tab-bar">
        <button onClick={() => setActiveTab('problems')} className={`tab-item flex items-center gap-2 ${activeTab === 'problems' ? 'tab-item-active' : 'tab-item-inactive'}`}>
          <AlertCircle size={14} /> Problems
          {counts.open > 0 && <span className="bg-danger-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{counts.open}</span>}
        </button>
        <button onClick={() => setActiveTab('feedback')} className={`tab-item flex items-center gap-2 ${activeTab === 'feedback' ? 'tab-item-active' : 'tab-item-inactive'}`}>
          <MessageSquare size={14} /> Feedback
        </button>
      </div>

      {activeTab === 'problems' && (
        <div className="space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries({ all: 'All', open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' }).map(([val, label]) => (
              <button key={val} onClick={() => setStatusFilter(val)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${statusFilter === val ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'}`}>
                {label} ({counts[val as keyof typeof counts]})
              </button>
            ))}
          </div>

          {problemsLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={AlertCircle} title="No problems found" description="No problems match the current filter." />
          ) : (
            <div className="space-y-3">
              {filtered.map(({ problem, hosteller, room }) => (
                <div key={problem.id} className="card p-4 hover:shadow-card-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${problem.status === 'resolved' ? 'bg-success-100' : problem.status === 'in_progress' ? 'bg-primary-100' : 'bg-warning-100'}`}>
                        {problem.status === 'resolved' ? <CheckCircle size={18} className="text-success-600" /> : problem.status === 'in_progress' ? <Clock size={18} className="text-primary-600" /> : <AlertCircle size={18} className="text-warning-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-ink-900">{problem.title}</h3>
                          {statusBadge(problem.status)}
                        </div>
                        <p className="text-sm text-ink-500 line-clamp-2">{problem.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-ink-400">
                          <span className="font-medium text-ink-600">{hosteller?.name || 'Unknown'}</span>
                          {room && <span>Room {room.room_number}</span>}
                          <span>{timeAgo(problem.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    {problem.status !== 'resolved' && (
                      <button
                        onClick={() => updateStatus(problem, STATUS_NEXT[problem.status])}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-xl font-semibold transition-colors flex-shrink-0"
                      >
                        <ArrowRight size={13} /> {STATUS_LABEL[STATUS_NEXT[problem.status]]}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="space-y-4">
          {feedbackLoading ? (
            <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
          ) : forms.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No feedback forms" description="Create feedback forms to gather insights from hostellers." action={{ label: 'Create Form', onClick: () => setShowCreate(true) }} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {forms.map(form => (
                <div key={form.id} className="card p-4 hover:shadow-card-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MessageSquare size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-900 truncate">{form.title}</p>
                      <p className="text-xs text-ink-400">{form.questions.length} questions · {timeAgo(form.created_at)}</p>
                    </div>
                  </div>
                  <button onClick={() => viewResponses(form)} className="w-full btn-secondary text-xs flex items-center justify-center gap-2">
                    <Eye size={13} /> View Responses
                  </button>
                </div>
              ))}
            </div>
          )}
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
                    className="text-xs px-2.5 py-1.5 bg-ink-100 hover:bg-ink-200 text-ink-700 rounded-lg font-medium transition-colors capitalize">
                    + {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {questions.length === 0 && <p className="text-sm text-ink-400 text-center py-4">Add questions using the buttons above</p>}
              {questions.map((q, i) => (
                <div key={q.id} className="border border-ink-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-ink-500 bg-ink-100 px-2 py-0.5 rounded-lg capitalize">{q.type.replace('_', ' ')}</span>
                    <button onClick={() => setQuestions(prev => prev.filter(x => x.id !== q.id))} className="text-danger-400 hover:text-danger-600">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <input value={q.question} onChange={e => updateQuestion(q.id, { question: e.target.value })} className="input text-sm mb-2" placeholder={`Question ${i + 1}`} />
                  {q.type === 'multiple_choice' && (
                    <div className="space-y-1">
                      {q.options?.map((opt, oi) => (
                        <input key={oi} value={opt} onChange={e => { const opts = [...(q.options || [])]; opts[oi] = e.target.value; updateQuestion(q.id, { options: opts }); }} className="input text-xs py-1" placeholder={`Option ${oi + 1}`} />
                      ))}
                      <button onClick={() => updateQuestion(q.id, { options: [...(q.options || []), ''] })} className="text-xs text-primary-600 hover:underline">+ Add option</button>
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
              <Send size={14} /> Create & Send
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!viewForm} onClose={() => setViewForm(null)} title={`Responses: ${viewForm?.title}`} size="xl">
        {responses.length === 0 ? (
          <p className="text-center text-ink-400 py-8">No responses yet</p>
        ) : (
          <div className="space-y-4">
            {responses.map(resp => (
              <div key={resp.id} className="border border-ink-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-700">{resp.hosteller?.name?.slice(0, 2).toUpperCase() || '?'}</span>
                  </div>
                  <span className="text-sm font-semibold text-ink-800">{resp.hosteller?.name || 'Anonymous'}</span>
                  <span className="text-xs text-ink-400 ml-auto">{timeAgo(resp.submitted_at)}</span>
                </div>
                <div className="space-y-2">
                  {viewForm?.questions.map(q => (
                    <div key={q.id} className="text-sm">
                      <span className="font-medium text-ink-700">{q.question}: </span>
                      <span className="text-ink-600">{String((resp.answers as any)[q.id] || '—')}</span>
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
