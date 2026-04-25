'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, Clock, AlertCircle, Copy, Loader2, Download } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/store/authStore';
import { formatCurrency, formatDate, getMonthName, getCurrentMonth, getCurrentYear } from '../../../src/utils';
import toast from 'react-hot-toast';
import type { RentPayment, Room } from '../../../src/types';

function UpiQrCode({ upiId, payeeName, amount, note }: { upiId: string; payeeName: string; amount: number; note: string }) {
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
      <p className="text-sm font-medium text-slate-700">Scan to pay via UPI</p>
      <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
        <img
          src={qrUrl}
          alt="UPI QR Code"
          width={180}
          height={180}
          className="rounded"
        />
      </div>
      <p className="text-xs text-slate-500">Open any UPI app and scan this code</p>
      <p className="text-xs font-mono text-slate-400">{upiId}</p>
    </div>
  );
}

export default function RentPayment() {
  const { hostellerProfile } = useAuthStore();
  const [currentRent, setCurrentRent] = useState<RentPayment | null>(null);
  const [history, setHistory] = useState<RentPayment[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [hostelName, setHostelName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const load = useCallback(async () => {
    if (!hostellerProfile) return;
    setLoading(true);
    const currentMonth = getCurrentMonth();
    const currentYear = getCurrentYear();

    const [hostelRes, roomRes, historyRes] = await Promise.all([
      supabase.from('hostels').select('name, upi_id').eq('id', hostellerProfile.hostel_id).maybeSingle(),
      hostellerProfile.room_id
        ? supabase.from('rooms').select('*').eq('id', hostellerProfile.room_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('rent_payments').select('*')
        .eq('hosteller_id', hostellerProfile.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(12),
    ]);

    const roomData = roomRes.data;
    const hostelData = hostelRes.data;

    setHostelName(hostelData?.name || '');
    setUpiId(hostelData?.upi_id || '');
    setRoom(roomData);
    setHistory(historyRes.data || []);

    if (hostellerProfile.room_id && roomData) {
      const { data: upsertedRent } = await supabase
        .from('rent_payments')
        .upsert(
          {
            hosteller_id: hostellerProfile.id,
            hostel_id: hostellerProfile.hostel_id,
            room_id: hostellerProfile.room_id,
            month: currentMonth,
            year: currentYear,
            amount: roomData.rent_amount,
            fine_amount: 0,
            status: 'unpaid',
            payment_mode: 'upi',
          },
          { onConflict: 'hosteller_id,month,year', ignoreDuplicates: true }
        )
        .select()
        .maybeSingle();

      const { data: rentData } = await supabase
        .from('rent_payments')
        .select('*')
        .eq('hosteller_id', hostellerProfile.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle();

      setCurrentRent(rentData || upsertedRent);
    }

    setLoading(false);
  }, [hostellerProfile]);

  useEffect(() => { load(); }, [load]);

  function copyUpiId() {
    if (!upiId) return;
    navigator.clipboard.writeText(upiId).then(() => toast.success('UPI ID copied!')).catch(() => toast.error('Copy failed'));
    setShowConfirm(true);
  }

  async function markAsPaid() {
    if (!hostellerProfile || !room) return;
    setMarkingPaid(true);
    const currentMonth = getCurrentMonth();
    const currentYear = getCurrentYear();

    if (currentRent?.id) {
      const { error } = await supabase.from('rent_payments').update({
        status: 'pending',
        payment_mode: 'upi',
        paid_at: new Date().toISOString(),
      }).eq('id', currentRent.id);
      if (error) { toast.error('Failed to submit payment verification'); setMarkingPaid(false); return; }
    } else {
      const { error } = await supabase.from('rent_payments').insert({
        hosteller_id: hostellerProfile.id,
        hostel_id: hostellerProfile.hostel_id,
        room_id: hostellerProfile.room_id!,
        month: currentMonth,
        year: currentYear,
        amount: room.rent_amount,
        fine_amount: 0,
        status: 'pending',
        payment_mode: 'upi',
        paid_at: new Date().toISOString(),
      });
      if (error) { toast.error('Failed to record payment'); setMarkingPaid(false); return; }
    }

    // Notify Owner
    await supabase.from('notifications').insert({
      user_id: hostellerProfile.owner_id,
      user_role: 'owner',
      type: 'rent_payment',
      message: `${hostellerProfile.name} has submitted a rent payment of ${formatCurrency(room.rent_amount)} via UPI. Please verify.`,
    });

    toast.success('Payment submitted! Awaiting owner verification.');
    setShowConfirm(false);
    load();
    setMarkingPaid(false);
  }

  async function downloadInvoice(payment: RentPayment) {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.createElement('div');
      element.innerHTML = `
        <div style="padding: 40px; font-family: sans-serif; color: #1e293b;">
          <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 20px;">Rent Receipt</h1>
          <p style="color: #64748b; margin-bottom: 40px;">${hostelName || 'Hostel'}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b;">Hosteller Name</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 500;">${hostellerProfile?.name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b;">Month</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 500;">${getMonthName(payment.month)} ${payment.year}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b;">Amount Paid</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 500;">Rs. ${payment.amount + (payment.fine_amount || 0)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b;">Payment Date</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 500;">${formatDate(payment.paid_at || '')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b;">Mode</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 500;">${payment.payment_mode?.toUpperCase()}</td>
            </tr>
          </table>
          
          <div style="text-align: center; color: #10b981; font-weight: bold; margin-top: 40px;">
            PAID IN FULL
          </div>
        </div>
      `;

      const opt = {
        margin: 1,
        filename: `Receipt_${getMonthName(payment.month)}_${payment.year}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF');
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 size={28} className="animate-spin text-primary-500" />
      </div>
    );
  }

  const currentMonth = getCurrentMonth();
  const currentYear = getCurrentYear();
  const totalDue = (currentRent?.amount || room?.rent_amount || 0) + (currentRent?.fine_amount || 0);
  const isPaid = currentRent?.status === 'paid';
  const isPending = currentRent?.status === 'pending';
  const isOverdue = currentRent?.status === 'overdue';

  const statusCfg = isPaid
    ? { border: 'border-emerald-300', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', label: 'Paid' }
    : isPending
    ? { border: 'border-blue-300', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', label: 'Pending Verification' }
    : isOverdue
    ? { border: 'border-red-300', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700', label: 'Overdue' }
    : { border: 'border-amber-300', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700', label: 'Due' };

  const upiNote = `Rent ${getMonthName(currentMonth)} ${currentYear}`;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Rent Payment</h1>
        <p className="text-sm text-slate-500">{getMonthName(currentMonth)} {currentYear}</p>
      </div>

      {/* Current Month */}
      <div className={`card p-5 border-2 ${statusCfg.border} ${statusCfg.bg}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-600">{getMonthName(currentMonth)} {currentYear}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{formatCurrency(totalDue)}</p>
            {(currentRent?.fine_amount || 0) > 0 && (
              <p className="text-xs text-red-600 mt-1">
                Includes late fee of {formatCurrency(currentRent!.fine_amount)}
              </p>
            )}
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 ${statusCfg.badge}`}>
            {isPaid && '✓ '}{statusCfg.label}
          </span>
        </div>

        {room && (
          <div className="flex flex-wrap gap-3 text-sm text-slate-600 mb-5">
            <span>Rent: {formatCurrency(currentRent?.amount || room.rent_amount)}</span>
            {(currentRent?.fine_amount || 0) > 0 && (
              <span className="text-red-600">Fine: {formatCurrency(currentRent!.fine_amount)}</span>
            )}
            <span className="uppercase">{room.room_type} · Room {room.room_number}</span>
          </div>
        )}

        {!isPaid && !isPending && (
          <div className="space-y-3">
            {upiId ? (
              <>
                <UpiQrCode
                  upiId={upiId}
                  payeeName={hostelName}
                  amount={totalDue}
                  note={upiNote}
                />

                <button
                  onClick={copyUpiId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl border border-slate-200 transition-colors text-sm"
                >
                  <Copy size={14} />
                  Copy UPI ID: <span className="font-mono text-primary-600 ml-1">{upiId}</span>
                </button>
              </>
            ) : null}

            {(showConfirm || !upiId) && (
              <div className="bg-white border-2 border-emerald-200 rounded-xl p-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Completed the payment?</p>
                <button
                  onClick={markAsPaid}
                  disabled={markingPaid}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {markingPaid ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  {markingPaid ? 'Confirming...' : "Yes, I've Paid — Confirm"}
                </button>
              </div>
            )}

            {upiId && !showConfirm && (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full text-sm text-slate-500 hover:text-slate-700 py-1 transition-colors"
              >
                Already paid? Click to confirm
              </button>
            )}
          </div>
        )}

        {isPaid && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-100 rounded-lg px-3 py-2.5">
            <CheckCircle size={16} />
            <span className="text-sm font-medium">
              Paid on {formatDate(currentRent?.paid_at || '')} via {currentRent?.payment_mode?.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {!upiId && !isPaid && !isPending && (
        <div className="card p-4 border border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">UPI not configured by hostel</p>
          <p className="text-xs text-amber-700 mt-1">
            Please pay rent in cash and ask the owner to mark your payment as received.
          </p>
        </div>
      )}

      {isPending && (
        <div className="card p-4 border border-blue-200 bg-blue-50">
          <p className="text-sm font-semibold text-blue-800">Payment verification pending</p>
          <p className="text-xs text-blue-700 mt-1">
            Your payment is awaiting verification from the hostel owner.
          </p>
        </div>
      )}

      {/* Payment History */}
      <div className="card p-4">
        <h3 className="font-semibold text-slate-800 mb-4">Payment History</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No payment history yet</p>
        ) : (
          <div className="space-y-2">
            {history.map(payment => (
              <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {payment.status === 'paid'
                    ? <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                    : payment.status === 'overdue'
                    ? <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                    : <Clock size={16} className="text-amber-500 flex-shrink-0" />
                  }
                  <div>
                    <p className="text-sm font-medium text-slate-800">{getMonthName(payment.month)} {payment.year}</p>
                    {payment.paid_at && <p className="text-xs text-slate-400">Paid {formatDate(payment.paid_at)}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">
                    {formatCurrency(payment.amount + (payment.fine_amount || 0))}
                  </p>
                  <span className={`text-xs font-medium capitalize ${
                    payment.status === 'paid' ? 'text-emerald-600'
                    : payment.status === 'pending' ? 'text-blue-600'
                    : payment.status === 'overdue' ? 'text-red-600'
                    : 'text-amber-600'
                  }`}>
                    {payment.status}
                  </span>
                  {payment.status === 'paid' && (
                    <button onClick={() => downloadInvoice(payment)} className="block mt-2 text-xs text-primary-600 hover:text-primary-700 flex items-center justify-end gap-1 ml-auto">
                      <Download size={12} /> Invoice
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
