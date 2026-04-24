'use client';
import React, { useEffect, useState } from 'react';
import { Clock, XCircle, Building2, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/store/authStore';
import toast from 'react-hot-toast';

interface PendingApprovalProps {
  status: 'pending' | 'rejected';
}

export default function PendingApproval({ status }: PendingApprovalProps) {
  const { reset, hostellerProfile, setHostellerProfile } = useAuthStore();
  const [hostelName, setHostelName] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (hostellerProfile?.hostel_id) {
      supabase.from('hostels').select('name').eq('id', hostellerProfile.hostel_id).maybeSingle()
        .then(({ data }) => setHostelName(data?.name || ''));
    }
  }, [hostellerProfile]);

  async function checkStatus() {
    if (!hostellerProfile) return;
    setChecking(true);
    const { data } = await supabase.from('hostellers').select('approval_status').eq('id', hostellerProfile.id).maybeSingle();
    if (data?.approval_status === 'approved') {
      setHostellerProfile({ ...hostellerProfile, approval_status: 'approved' });
      toast.success('Your account has been approved! Welcome aboard.');
    } else {
      toast.error('Not approved yet. Please check back later.');
    }
    setChecking(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    reset();
  }

  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Registration Declined</h1>
            <p className="text-slate-500 text-sm mb-1">
              Your registration request for <span className="font-semibold text-slate-700">{hostelName || 'the hostel'}</span> was not approved.
            </p>
            <p className="text-slate-400 text-sm mb-6">
              Please contact the hostel management office directly for assistance or to provide additional information.
            </p>
            <button onClick={handleLogout} className="btn-secondary flex items-center gap-2 mx-auto text-sm">
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock size={32} className="text-amber-500" />
          </div>

          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-6 h-6 bg-primary-600 rounded-md flex items-center justify-center">
              <Building2 size={13} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-700">{hostelName || 'HostelOS'}</span>
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-2">Awaiting Approval</h1>
          <p className="text-slate-500 text-sm mb-6">
            Your registration is under review by the hostel management. You will be notified once your account is approved.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs font-semibold text-amber-800 mb-2">What happens next?</p>
            <ul className="text-xs text-amber-700 space-y-1.5">
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0" />
                The hostel owner reviews your details
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0" />
                You'll receive an in-app notification upon approval
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0" />
                After approval, full access to the resident portal is granted
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={checkStatus} disabled={checking} className="btn-primary flex items-center gap-2 flex-1 justify-center text-sm">
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              {checking ? 'Checking...' : 'Check Status'}
            </button>
            <button onClick={handleLogout} className="btn-secondary text-sm px-4">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
