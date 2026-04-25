'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { ensureOwnerAuthRecords } from '../../../src/services/authBootstrap';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

export default function OwnerSignup() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            phone: data.phone,
            role: 'owner',
          },
        },
      });
      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('User creation failed');

      let signedInUser = authData.user;

      if (!authData.session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (signInError) {
          // If email confirmation is enabled, this path is expected.
          if (signInError.message.toLowerCase().includes('confirm')) {
            toast.success('Account created. Please verify your email, then sign in.');
            router.push('/owner/login');
            return;
          }
          throw signInError;
        }

        if (!signInData.user) {
          throw new Error('Could not start session after signup. Please try signing in.');
        }

        signedInUser = signInData.user;
      }

      await ensureOwnerAuthRecords({
        userId: signedInUser.id,
        email: signedInUser.email ?? data.email,
        name: data.name,
        phone: data.phone,
      });

      toast.success('Account created successfully!');
      router.push('/owner/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
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
          <h1 className="text-3xl font-bold text-white">HostelOS Owner</h1>
          <p className="text-slate-400 mt-1 text-sm">B2B Hostel Management Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Create owner account</h2>
          <p className="text-sm text-slate-500 mb-4">Register to manage your hostel on HostelOS</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input {...register('name')} type="text" placeholder="John Doe" className="input" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="label">Email address</label>
              <input {...register('email')} type="email" placeholder="owner@example.com" className="input" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Phone Number</label>
              <input {...register('phone')} type="tel" placeholder="+91 98765 43210" className="input" />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input pr-10"
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
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link href="/owner/login" className="text-primary-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
