'use client';
import React, { useEffect, useState } from 'react';
import { Phone, MapPin, Calendar, Users, User, Building2, CreditCard as Edit2, Save, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/store/authStore';
import { formatDate, maskAadhar } from '../../../src/utils';
import toast from 'react-hot-toast';
import type { Room, Floor, Hosteller } from '../../../src/types';

export default function HostellerHome() {
  const { hostellerProfile, setHostellerProfile } = useAuthStore();
  const [room, setRoom] = useState<Room | null>(null);
  const [floor, setFloor] = useState<Floor | null>(null);
  const [hostelName, setHostelName] = useState('');
  const [roommates, setRoommates] = useState<Hosteller[]>([]);
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hostellerProfile) loadDetails();
  }, [hostellerProfile]);

  async function loadDetails() {
    if (!hostellerProfile) return;
    setLoading(true);
    setError(null);

    const [hostelRes, roomRes] = await Promise.all([
      supabase.from('hostels').select('name').eq('id', hostellerProfile.hostel_id).maybeSingle(),
      hostellerProfile.room_id
        ? supabase.from('rooms').select('*').eq('id', hostellerProfile.room_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (hostelRes.error) setError(hostelRes.error.message);
    setHostelName(hostelRes.data?.name || '');
    if (roomRes.data) {
      setRoom(roomRes.data);
      const floorRes = await supabase.from('floors').select('*').eq('id', roomRes.data.floor_id).maybeSingle();
      setFloor(floorRes.data);

      const { data: rmData } = await supabase.from('hostellers')
        .select('id, name, phone')
        .eq('room_id', hostellerProfile.room_id)
        .eq('status', 'active')
        .neq('id', hostellerProfile.id);
      setRoommates(rmData || []);
    }
    setLoading(false);
  }

  async function savePhone() {
    if (!hostellerProfile) return;
    const { error } = await supabase.from('hostellers').update({ phone: newPhone }).eq('id', hostellerProfile.id);
    if (error) { toast.error('Failed to update phone'); return; }
    setHostellerProfile({ ...hostellerProfile, phone: newPhone });
    setEditingPhone(false);
    toast.success('Phone updated');
  }

  if (loading) {
    return <div className="p-6 space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500">Your room and personal details</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Failed to load some data</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div className="card p-5">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-primary-700">{hostellerProfile?.name?.slice(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{hostellerProfile?.name}</h2>
            <p className="text-sm text-slate-500">{hostellerProfile?.email}</p>
            <span className="badge-green mt-1">Active Resident</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Phone size={16} className="text-slate-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-0.5">Phone</p>
              {editingPhone ? (
                <div className="flex items-center gap-2">
                  <input value={newPhone} onChange={e => setNewPhone(e.target.value)} className="input text-sm py-0.5 flex-1" />
                  <button onClick={savePhone} className="text-emerald-600 hover:text-emerald-700"><Save size={14} /></button>
                  <button onClick={() => setEditingPhone(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800">{hostellerProfile?.phone}</p>
                  <button onClick={() => { setEditingPhone(true); setNewPhone(hostellerProfile?.phone || ''); }}
                    className="text-slate-400 hover:text-primary-600"><Edit2 size={12} /></button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Building2 size={16} className="text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Hostel</p>
              <p className="text-sm font-medium text-slate-800">{hostelName}</p>
            </div>
          </div>

          {room && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <MapPin size={16} className="text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Room</p>
                <p className="text-sm font-medium text-slate-800">Room {room.room_number}, Floor {floor?.floor_number}</p>
                <p className="text-xs text-slate-400 capitalize">{room.room_type} • {room.sharing_type} sharing</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Calendar size={16} className="text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Move-in Date</p>
              <p className="text-sm font-medium text-slate-800">{formatDate(hostellerProfile?.move_in_date || '')}</p>
            </div>
          </div>

          {hostellerProfile?.aadhar_number && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <User size={16} className="text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Aadhaar</p>
                <p className="text-sm font-medium text-slate-800">{maskAadhar(hostellerProfile.aadhar_number)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Roommates */}
      {room && (room.sharing_type !== 'single') && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-slate-600" />
            <h3 className="font-semibold text-slate-800">Roommates</h3>
          </div>
          {roommates.length === 0 ? (
            <p className="text-sm text-slate-400">No roommates currently</p>
          ) : (
            <div className="space-y-2">
              {roommates.map(rm => (
                <div key={rm.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary-700">{rm.name?.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{rm.name}</p>
                    {hostellerProfile?.allow_roommate_details && (
                      <p className="text-xs text-slate-400">{rm.phone}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
