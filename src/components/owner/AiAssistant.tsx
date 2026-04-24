import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Mic, MicOff, Loader2, X, Minimize2, Maximize2, Sparkles, User, Table2, BarChart3, Bell } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useHostelStore } from '../../store/hostelStore';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: Record<string, string | number>[];
  type?: 'text' | 'table' | 'stats';
  actions?: { label: string; action: string }[];
  timestamp: Date;
}

const SUGGESTIONS = [
  'How many tenants have not paid rent?',
  'Which rooms are vacant?',
  'Total revenue this month?',
  'Show overdue tenants',
  'How many active residents?',
  'Room type breakdown?',
];

export default function AiAssistant() {
  const { selectedHostelId } = useHostelStore();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your hostel AI assistant. Ask me anything about your residents, rooms, or rent collection.",
      type: 'text',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input not supported in this browser');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function sendMessage(text?: string) {
    const query = (text || input).trim();
    if (!query || !selectedHostelId) return;
    setInput('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      type: 'text',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'Apikey': anonKey,
        },
        body: JSON.stringify({ query, hostel_id: selectedHostelId }),
      });

      const result = await res.json();

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.answer || "Sorry, I couldn't process that.",
        data: result.data,
        type: result.type || 'text',
        actions: result.actions,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        type: 'text',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: string) {
    if (action === 'send_reminders') {
      await sendMessage('Send rent reminders to all unpaid tenants');
    } else if (action === 'send_reminders_overdue') {
      await sendMessage('Send rent reminders to overdue tenants');
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl shadow-card-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="AI Assistant"
      >
        <Sparkles size={22} />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex flex-col bg-white rounded-2xl shadow-card-lg border border-ink-200 transition-all duration-200 ${minimized ? 'h-14 w-72' : 'w-[380px] h-[560px] sm:w-[420px]'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-primary-600 rounded-t-2xl flex-shrink-0">
        <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Hostel AI Assistant</p>
          {!minimized && <p className="text-xs text-white/70">Ask anything about your hostel</p>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(m => !m)} className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
            {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-primary-600' : 'bg-ink-100'}`}>
                  {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-primary-600" />}
                </div>
                <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-ink-50 text-ink-800 rounded-tl-sm border border-ink-100'}`}>
                    {msg.content}
                  </div>

                  {msg.data && msg.data.length > 0 && (msg.type === 'table') && (
                    <div className="w-full overflow-x-auto rounded-xl border border-ink-200 shadow-card">
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="bg-ink-50 border-b border-ink-200">
                            {Object.keys(msg.data[0]).map(k => (
                              <th key={k} className="text-left px-3 py-2 font-semibold text-ink-600 whitespace-nowrap">{k.replace('_', ' ')}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-100">
                          {msg.data.map((row, i) => (
                            <tr key={i} className="hover:bg-ink-50">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="px-3 py-2 text-ink-700 whitespace-nowrap">{String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {msg.data && msg.data.length > 0 && msg.type === 'stats' && (
                    <div className="flex gap-2 flex-wrap w-full">
                      {Object.entries(msg.data[0]).map(([k, v]) => (
                        <div key={k} className="bg-primary-50 border border-primary-100 rounded-xl px-3 py-2 text-center">
                          <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide">{k.replace('_', ' ')}</p>
                          <p className="text-sm font-bold text-primary-700 mt-0.5">{String(v)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {msg.actions.map(a => (
                        <button key={a.action} onClick={() => handleAction(a.action)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors">
                          <Bell size={11} /> {a.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] text-ink-300 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-ink-100 flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-primary-600" />
                </div>
                <div className="px-3.5 py-2.5 bg-ink-50 border border-ink-100 rounded-2xl rounded-tl-sm">
                  <Loader2 size={14} className="animate-spin text-ink-400" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-ink-400 font-semibold mb-2">Try asking:</p>
              <div className="flex gap-1.5 flex-wrap">
                {SUGGESTIONS.slice(0, 4).map(s => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="text-xs px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg font-medium hover:bg-primary-100 transition-colors border border-primary-100">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-ink-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={listening ? 'Listening...' : 'Ask anything...'}
                  className={`input pr-4 text-sm ${listening ? 'border-danger-400 bg-danger-50 placeholder:text-danger-400' : ''}`}
                  disabled={loading || listening}
                />
              </div>
              <button
                onClick={listening ? stopListening : startListening}
                disabled={loading}
                className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${listening ? 'bg-danger-500 text-white hover:bg-danger-600 animate-pulse' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'}`}
                title={listening ? 'Stop listening' : 'Voice input'}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="p-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
