'use client';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { ensureHostellerRoleRecord } from '../../../src/services/authBootstrap';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function HostellerLogin() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorMsg = params.get('error');
      if (errorMsg) toast.error(errorMsg, { duration: 6000 });
    }
  }, []);

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;

      const metadataRole = authData.user.user_metadata?.role;
      if (metadataRole === 'hosteller') {
        await ensureHostellerRoleRecord(authData.user.id);
      }

      // Verify Role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (roleError) {
        await supabase.auth.signOut();
        throw new Error(`Role verification failed: ${roleError.message}`);
      }

      if (roleData?.role !== 'hosteller') {
        await supabase.auth.signOut();
        throw new Error('Unauthorized: You do not have a Hosteller account.');
      }

      router.push('/hosteller/home');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">HostelOS Resident</h1>
          <p className="text-slate-400 mt-1 text-sm">Resident Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Sign in to Resident Portal</h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
            <p className="text-xs text-blue-700">
              Use the email and password provided by your hostel owner to log in.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                {...register('email')}
                type="email"
                placeholder="resident@example.com"
                className="input"
                autoComplete="email"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button type="submit" className="btn-primary w-full py-2.5 mt-2 flex items-center justify-center gap-2" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
