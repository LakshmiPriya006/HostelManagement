import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Modal from '../shared/Modal';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useHostelStore } from '../../store/hostelStore';
import { getCurrentMonth, getCurrentYear } from '../../utils';
import toast from 'react-hot-toast';
import type { Room } from '../../types';

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(10, 'Valid phone required'),
  aadhar_number: z.string().optional(),
  room_id: z.string().min(1, 'Room required'),
  move_in_date: z.string().min(1, 'Move-in date required'),
  rent_paid: z.boolean().default(false),
  payment_mode: z.enum(['upi', 'cash']).default('cash'),
});

type FormData = z.infer<typeof schema>;

interface AddHostellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  rooms: Room[];
}

export default function AddHostellerModal({ isOpen, onClose, onSuccess, rooms }: AddHostellerModalProps) {
  const { user } = useAuthStore();
  const { selectedHostelId } = useHostelStore();
  const [loading, setLoading] = useState(false);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);

  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      move_in_date: new Date().toISOString().split('T')[0],
      rent_paid: false,
      payment_mode: 'cash',
    },
  });

  const rentPaid = watch('rent_paid');
  const selectedRoomId = watch('room_id');
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  async function onSubmit(data: FormData) {
    if (!user || !selectedHostelId) return;
    setLoading(true);
    try {
      let aadhar_url = '';
      if (aadhaarFile) {
        const fileExt = aadhaarFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, aadhaarFile);
        if (uploadError) throw new Error('Aadhaar upload failed: ' + uploadError.message);
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);
        aadhar_url = publicUrl;
      }

      const defaultPassword = (useHostelStore.getState().getSelectedHostel() as any)?.default_hosteller_password || '123456';

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || anonKey;

      const res = await fetch(`${supabaseUrl}/functions/v1/create-hosteller`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Apikey': anonKey,
        },
        body: JSON.stringify({
          email: data.email,
          password: defaultPassword,
          name: data.name,
          phone: data.phone,
          aadhar_number: data.aadhar_number || '',
          aadhar_url,
          room_id: data.room_id,
          hostel_id: selectedHostelId,
          owner_id: user.id,
          move_in_date: data.move_in_date,
          rent_paid: data.rent_paid,
          payment_mode: data.payment_mode,
          rent_amount: selectedRoom?.rent_amount ?? 0,
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || `Server error (${res.status})`);


      toast.success(`${data.name} added successfully! They can log in with their email and the default password.`);
      reset();
      setAadhaarFile(null);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add hosteller');
    } finally {
      setLoading(false);
    }
  }

  const availableRooms = rooms.filter(r => r.status !== 'occupied');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Onboard New Hosteller" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700">
            The hosteller will use their email and the hostel's default password to log in. They can change their password later.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Full Name *</label>
            <input {...register('name')} className="input" placeholder="John Doe" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Email *</label>
            <input {...register('email')} type="email" className="input" placeholder="john@example.com" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Phone *</label>
            <input {...register('phone')} type="tel" className="input" placeholder="+91 98765 43210" />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>

          <div className="col-span-2">
            <label className="label">Aadhaar Document</label>
            <input 
              type="file" 
              accept="image/*,.pdf"
              onChange={(e) => setAadhaarFile(e.target.files?.[0] || null)}
              className="input text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" 
            />
          </div>

          <div>
            <label className="label">Aadhaar Number</label>
            <input {...register('aadhar_number')} className="input" placeholder="12-digit number" maxLength={12} />
          </div>

          <div>
            <label className="label">Move-in Date *</label>
            <input {...register('move_in_date')} type="date" className="input" />
            {errors.move_in_date && <p className="text-red-500 text-xs mt-1">{errors.move_in_date.message}</p>}
          </div>

          <div className="col-span-2">
            <label className="label">Assign Room *</label>
            <select {...register('room_id')} className="input">
              <option value="">Select a room</option>
              {availableRooms.map(r => (
                <option key={r.id} value={r.id}>
                  Room {r.room_number} — {r.room_type.toUpperCase()}, {r.sharing_type} — ₹{r.rent_amount}/mo
                </option>
              ))}
            </select>
            {errors.room_id && <p className="text-red-500 text-xs mt-1">{errors.room_id.message}</p>}
            {availableRooms.length === 0 && (
              <p className="text-amber-600 text-xs mt-1">All rooms are fully occupied.</p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('rent_paid')} className="w-4 h-4 text-primary-600 rounded" />
            <span className="text-sm font-medium text-slate-700">Mark this month's rent as paid</span>
          </label>
          {rentPaid && (
            <div className="mt-3">
              <label className="label">Payment Mode</label>
              <div className="flex gap-3">
                {(['cash', 'upi'] as const).map(mode => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" {...register('payment_mode')} value={mode} className="w-4 h-4 text-primary-600" />
                    <span className="text-sm text-slate-700 uppercase">{mode}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm" disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary text-sm flex items-center gap-2" disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Creating Account...' : 'Add Hosteller'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
