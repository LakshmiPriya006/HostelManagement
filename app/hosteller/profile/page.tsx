'use client';
import React, { useState } from 'react';
import { Save, Loader2, Key } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../src/store/authStore';

export default function HostellerProfile() {
  const { hostellerProfile } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    
    if (error) {
      toast.error('Failed to update password');
    } else {
      toast.success('Password updated successfully');
      setPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500">Manage your account settings</p>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          Personal Information
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Name</label>
            <input value={hostellerProfile?.name || ''} disabled className="input bg-slate-50 cursor-not-allowed" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input value={hostellerProfile?.phone || ''} disabled className="input bg-slate-50 cursor-not-allowed" />
          </div>
          <div className="col-span-2">
            <label className="label">Email</label>
            <input value={hostellerProfile?.email || ''} disabled className="input bg-slate-50 cursor-not-allowed" />
          </div>
        </div>
        <p className="text-xs text-slate-500">Contact your hostel owner to update personal details.</p>
      </div>

      <form onSubmit={updatePassword} className="card p-5 space-y-4">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Key size={18} className="text-primary-600" /> Change Password
        </h2>
        
        <div>
          <label className="label">New Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            className="input" 
            placeholder="Min. 6 characters" 
          />
        </div>
        
        <div>
          <label className="label">Confirm New Password</label>
          <input 
            type="password" 
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)} 
            className="input" 
            placeholder="Confirm password" 
          />
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={loading || !password} className="btn-primary flex items-center gap-2 text-sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Update Password
          </button>
        </div>
      </form>
    </div>
  );
}
