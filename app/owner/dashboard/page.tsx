'use client';
import React, { useEffect, useState } from 'react';
import {
  Building2, Users, TrendingUp, CreditCard, AlertCircle, CheckCircle,
  ArrowUpRight, Home
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from '../../../src/services/supabase';
import { useHostelStore } from '../../../src/store/hostelStore';
import { CardSkeleton } from '../../../src/components/shared/LoadingSkeleton';
import { formatCurrency, getMonthName, getCurrentMonth, getCurrentYear } from '../../../src/utils';
import type { Room, RentPayment, Problem, Hosteller } from '../../../src/types';

interface DashboardStats {
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  totalHostellers: number;
  paidThisMonth: number;
  unpaidCount: number;
  overdueCount: number;
  openProblems: number;
  expectedRevenue: number;
  collectedRevenue: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Dashboard() {
  const { selectedHostelId, getSelectedHostel } = useHostelStore();
  const hostel = getSelectedHostel();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [roomTypeData, setRoomTypeData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedHostelId) loadDashboard();
  }, [selectedHostelId]);

  async function loadDashboard() {
    if (!selectedHostelId) return;
    setLoading(true);
    try {
      const currentMonth = getCurrentMonth();
      const currentYear = getCurrentYear();

      const [roomsRes, hostellerRes, rentRes, problemsRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('hostel_id', selectedHostelId),
        supabase.from('hostellers').select('*').eq('hostel_id', selectedHostelId).eq('status', 'active'),
        supabase.from('rent_payments').select('*').eq('hostel_id', selectedHostelId).eq('year', currentYear),
        supabase.from('problems').select('*').eq('hostel_id', selectedHostelId).neq('status', 'resolved'),
      ]);

      const rooms: Room[] = roomsRes.data || [];
      const hostellers: Hosteller[] = hostellerRes.data || [];
      const allRents: RentPayment[] = rentRes.data || [];
      const thisMonthRents = allRents.filter(r => r.month === currentMonth);

      const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
      const paidThisMonth = thisMonthRents.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
      const unpaidCount = thisMonthRents.filter(r => r.status === 'unpaid').length;
      const overdueCount = thisMonthRents.filter(r => r.status === 'overdue').length;
      const expectedRevenue = hostellers.reduce((sum, _) => sum, 0);

      setStats({
        totalRooms: rooms.length,
        occupiedRooms,
        availableRooms: rooms.filter(r => r.status === 'available').length,
        totalHostellers: hostellers.length,
        paidThisMonth,
        unpaidCount,
        overdueCount,
        openProblems: problemsRes.data?.length || 0,
        expectedRevenue: thisMonthRents.reduce((sum, r) => sum + r.amount + (r.fine_amount || 0), 0),
        collectedRevenue: paidThisMonth,
      });

      // Monthly trend (last 6 months)
      const trend: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const monthRents = allRents.filter(r => r.month === m && r.year === y && r.status === 'paid');
        trend.push({
          name: getMonthName(m).slice(0, 3),
          collected: monthRents.reduce((sum, r) => sum + r.amount, 0),
        });
      }
      setMonthlyData(trend);

      // Room type breakdown
      const acCount = rooms.filter(r => r.room_type === 'ac').length;
      const nonAcCount = rooms.filter(r => r.room_type === 'non-ac').length;
      setRoomTypeData([
        { name: 'AC', value: acCount },
        { name: 'Non-AC', value: nonAcCount },
      ]);

      // Recent activity from rent payments
      const { data: recentRents } = await supabase
        .from('rent_payments')
        .select('*, hostellers(name, room_id)')
        .eq('hostel_id', selectedHostelId)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .limit(5);
      setRecentActivity(recentRents || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!hostel) {
    return (
      <div className="p-6 text-center">
        <Building2 size={40} className="text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500">No hostel selected. Please select or create a hostel.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  const occupancyRate = stats ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) || 0 : 0;

  const statCards = [
    { label: 'Total Rooms', value: stats?.totalRooms || 0, icon: Home, color: 'bg-blue-50 text-blue-600', change: `${stats?.availableRooms} available` },
    { label: 'Occupied', value: stats?.occupiedRooms || 0, icon: Users, color: 'bg-emerald-50 text-emerald-600', change: `${occupancyRate}% occupancy` },
    { label: 'Rent Collected', value: formatCurrency(stats?.collectedRevenue || 0), icon: CreditCard, color: 'bg-primary-50 text-primary-600', change: `Expected: ${formatCurrency(stats?.expectedRevenue || 0)}` },
    { label: 'Unpaid Rents', value: (stats?.unpaidCount || 0) + (stats?.overdueCount || 0), icon: TrendingUp, color: 'bg-amber-50 text-amber-600', change: `${stats?.overdueCount} overdue` },
    { label: 'Open Problems', value: stats?.openProblems || 0, icon: AlertCircle, color: 'bg-red-50 text-red-600', change: 'Needs attention' },
    { label: 'Active Hostellers', value: stats?.totalHostellers || 0, icon: CheckCircle, color: 'bg-teal-50 text-teal-600', change: 'Currently residing' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">{hostel.name}</h1>
        <p className="text-sm text-slate-500">{hostel.address}, {hostel.city}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon size={18} />
              </div>
              <ArrowUpRight size={14} className="text-slate-300" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-0.5">{card.value}</div>
            <div className="text-sm font-medium text-slate-600">{card.label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{card.change}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart */}
        <div className="card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Monthly Rent Collection (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), 'Collected']} />
              <Bar dataKey="collected" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Room Type Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={roomTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {roomTypeData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend iconType="circle" iconSize={8} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Recent Payments</h3>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No recent payments</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CreditCard size={14} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.hostellers?.name || 'Hosteller'}</p>
                    <p className="text-xs text-slate-400">{getMonthName(item.month)} {item.year} • {item.payment_mode?.toUpperCase()}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-emerald-600">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
