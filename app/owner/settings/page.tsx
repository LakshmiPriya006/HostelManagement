'use client';
import React, { useState, useEffect } from 'react';
import { Save, Plus, Building2, Loader2, MessageCircle, Bell, ExternalLink, Send, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../../src/services/supabase';
import { useHostelStore } from '../../../src/store/hostelStore';
import { useAuthStore } from '../../../src/store/authStore';
import toast from 'react-hot-toast';

export default function Settings() {
  const { selectedHostelId, getSelectedHostel, hostels, setHostels, setSelectedHostelId } = useHostelStore();
  const { user, ownerProfile, setOwnerProfile } = useAuthStore();
  const hostel = getSelectedHostel();
  const [activeTab, setActiveTab] = useState<'hostel' | 'profile' | 'hostels' | 'whatsapp'>('hostel');
  const [savingHostel, setSavingHostel] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderPreview, setReminderPreview] = useState<{ name: string; phone: string; whatsapp_url: string }[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const hostelForm = useForm({
    defaultValues: {
      name: hostel?.name || '',
      address: hostel?.address || '',
      city: hostel?.city || '',
      upi_id: hostel?.upi_id || '',
      rules_and_regulations: hostel?.rules_and_regulations || '',
      late_fee_amount: hostel?.late_fee_amount || 0,
      rent_due_date_day: hostel?.rent_due_date_day || 5,
      default_hosteller_password: (hostel as any)?.default_hosteller_password || '123456',
    }
  });

  const profileForm = useForm({
    defaultValues: {
      name: ownerProfile?.name || '',
      phone: ownerProfile?.phone || '',
    }
  });

  useEffect(() => {
    if (hostel) {
      hostelForm.reset({
        name: hostel.name,
        address: hostel.address,
        city: hostel.city,
        upi_id: hostel.upi_id,
        rules_and_regulations: hostel.rules_and_regulations,
        late_fee_amount: hostel.late_fee_amount,
        rent_due_date_day: hostel.rent_due_date_day,
        default_hosteller_password: (hostel as any).default_hosteller_password || '123456',
      });
      setWhatsappEnabled(!!(hostel as any).whatsapp_reminders_enabled);
    }
  }, [hostel]);

  async function saveHostelSettings(data: any) {
    if (!selectedHostelId) return;
    setSavingHostel(true);
    const { error } = await supabase.from('hostels').update(data).eq('id', selectedHostelId);
    if (error) { toast.error('Failed to save settings'); }
    else {
      toast.success('Hostel settings saved');
      const { data: allHostels } = await supabase.from('hostels').select('*').eq('owner_id', user?.id);
      if (allHostels) setHostels(allHostels);
    }
    setSavingHostel(false);
  }

  async function saveProfileSettings(data: any) {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from('owners').update(data).eq('id', user.id);
    if (error) { toast.error('Failed to save profile'); }
    else {
      toast.success('Profile updated');
      setOwnerProfile({ ...ownerProfile!, ...data });
    }
    setSavingProfile(false);
  }

  async function toggleWhatsapp(enabled: boolean) {
    if (!selectedHostelId) return;
    setSavingWhatsapp(true);
    const { error } = await supabase.from('hostels').update({ whatsapp_reminders_enabled: enabled }).eq('id', selectedHostelId);
    if (error) { toast.error('Failed to update setting'); }
    else {
      setWhatsappEnabled(enabled);
      toast.success(enabled ? 'WhatsApp reminders enabled' : 'WhatsApp reminders disabled');
    }
    setSavingWhatsapp(false);
  }

  async function loadPreview() {
    if (!selectedHostelId) return;
    setPreviewLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'Apikey': anonKey,
        },
        body: JSON.stringify({ hostel_id: selectedHostelId, dry_run: true }),
      });
      const result = await res.json();
      setReminderPreview(result.results || []);
      if ((result.results || []).length === 0) toast('No unpaid tenants found this month', { icon: 'ℹ️' });
    } catch {
      toast.error('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function sendWhatsappReminders() {
    if (!selectedHostelId) return;
    setSendingReminders(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'Apikey': anonKey,
        },
        body: JSON.stringify({ hostel_id: selectedHostelId, dry_run: false }),
      });
      const result = await res.json();
      if (result.results && result.results.length > 0) {
        result.results.forEach((r: { whatsapp_url: string }) => window.open(r.whatsapp_url, '_blank'));
        toast.success(`Opened WhatsApp for ${result.results.length} tenant(s)`);
      } else {
        toast('No unpaid tenants found', { icon: 'ℹ️' });
      }
    } catch {
      toast.error('Failed to send reminders');
    } finally {
      setSendingReminders(false);
    }
  }

  const tabs = [
    { key: 'hostel', label: 'Hostel' },
    { key: 'profile', label: 'Profile' },
    { key: 'hostels', label: 'My Hostels' },
    { key: 'whatsapp', label: 'WhatsApp' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="section-title">Settings</h1>
        <p className="section-subtitle">Manage hostel and account settings</p>
      </div>

      <div className="tab-bar flex-wrap">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`tab-item ${activeTab === tab.key ? 'tab-item-active' : 'tab-item-inactive'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'hostel' && (
        <form onSubmit={hostelForm.handleSubmit(saveHostelSettings)} className="card p-6 space-y-4 max-w-2xl">
          <h2 className="font-semibold text-ink-800">Hostel Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Hostel Name</label>
              <input {...hostelForm.register('name')} className="input" />
            </div>
            <div>
              <label className="label">City</label>
              <input {...hostelForm.register('city')} className="input" />
            </div>
            <div>
              <label className="label">UPI ID</label>
              <input {...hostelForm.register('upi_id')} className="input" placeholder="hostel@upi" />
            </div>
            <div>
              <label className="label">Rent Due Date (Day 1-28)</label>
              <input {...hostelForm.register('rent_due_date_day', { valueAsNumber: true })} type="number" min={1} max={28} className="input w-24" />
            </div>
            <div>
              <label className="label">Default Password for Hostellers</label>
              <input {...hostelForm.register('default_hosteller_password')} type="text" className="input" placeholder="123456" />
            </div>
            <div>
              <label className="label">Late Fee (&#8377;)</label>
              <input {...hostelForm.register('late_fee_amount', { valueAsNumber: true })} type="number" min={0} className="input w-32" />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input {...hostelForm.register('address')} className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Rules &amp; Regulations</label>
              <textarea {...hostelForm.register('rules_and_regulations')} rows={5} className="input resize-none" placeholder="Enter hostel rules..." />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingHostel} className="btn-primary flex items-center gap-2 text-sm">
              {savingHostel ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Changes
            </button>
          </div>
        </form>
      )}

      {activeTab === 'profile' && (
        <form onSubmit={profileForm.handleSubmit(saveProfileSettings)} className="card p-6 space-y-4 max-w-md">
          <h2 className="font-semibold text-ink-800">Owner Profile</h2>
          <div>
            <label className="label">Full Name</label>
            <input {...profileForm.register('name')} className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input {...profileForm.register('phone')} className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input value={ownerProfile?.email || ''} disabled className="input bg-ink-50 text-ink-400 cursor-not-allowed" />
            <p className="text-xs text-ink-400 mt-1">Email cannot be changed</p>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingProfile} className="btn-primary flex items-center gap-2 text-sm">
              {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Profile
            </button>
          </div>
        </form>
      )}

      {activeTab === 'hostels' && (
        <div className="max-w-2xl space-y-4">
          <div className="space-y-3">
            {hostels.map(h => (
              <div key={h.id} className={`card p-4 flex items-center justify-between ${h.id === selectedHostelId ? 'border-primary-300 bg-primary-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Building2 size={16} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink-800">{h.name}</p>
                    <p className="text-xs text-ink-400">{h.city} &bull; {h.total_floors} floors</p>
                  </div>
                </div>
                {h.id !== selectedHostelId && (
                  <button onClick={() => setSelectedHostelId(h.id)} className="btn-secondary text-sm">Switch</button>
                )}
                {h.id === selectedHostelId && <span className="badge-blue">Active</span>}
              </div>
            ))}
          </div>
          <button onClick={() => window.location.href = '/owner/setup'} className="btn-secondary flex items-center gap-2 text-sm w-full justify-center">
            <Plus size={16} /> Add New Hostel
          </button>
        </div>
      )}

      {activeTab === 'whatsapp' && (
        <div className="max-w-2xl space-y-5">
          {/* Enable toggle */}
          <div className="card p-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-green-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <MessageCircle size={22} className="text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink-900">WhatsApp Rent Reminders</h3>
                <p className="text-sm text-ink-500 mt-1">
                  Automatically send personalized WhatsApp messages to tenants who haven't paid rent. Messages include their name, amount due, room number, and a UPI payment link.
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={() => toggleWhatsapp(!whatsappEnabled)}
                    disabled={savingWhatsapp}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${whatsappEnabled ? 'bg-green-500' : 'bg-ink-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${whatsappEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm font-medium text-ink-700">
                    {whatsappEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  {savingWhatsapp && <Loader2 size={14} className="animate-spin text-ink-400" />}
                </div>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-ink-900 flex items-center gap-2">
              <Bell size={16} className="text-primary-600" /> How it works
            </h3>
            <div className="space-y-2">
              {[
                'Each message is personalized with the tenant\'s name, room number, and exact amount due.',
                'A UPI payment link is included so tenants can pay directly.',
                'Messages open in WhatsApp Web or app — you send them manually for full control.',
                'In-app notifications are also sent automatically.',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <CheckCircle size={14} className="text-success-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-600">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Send now */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-ink-900">Send Reminders Now</h3>
            <p className="text-sm text-ink-500">
              This will generate WhatsApp messages for all tenants with unpaid rent this month.
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={loadPreview}
                disabled={previewLoading}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {previewLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                Preview Recipients
              </button>
              <button
                onClick={sendWhatsappReminders}
                disabled={sendingReminders}
                className="btn-primary flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700"
              >
                {sendingReminders ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send WhatsApp Reminders
              </button>
            </div>

            {reminderPreview.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">{reminderPreview.length} tenants to be reminded:</p>
                {reminderPreview.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-ink-50 rounded-xl">
                    <div>
                      <span className="text-sm font-semibold text-ink-800">{r.name}</span>
                      <span className="text-xs text-ink-400 ml-2">{r.phone}</span>
                    </div>
                    <a href={r.whatsapp_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:text-green-700 font-semibold flex items-center gap-1">
                      <MessageCircle size={12} /> Open
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
