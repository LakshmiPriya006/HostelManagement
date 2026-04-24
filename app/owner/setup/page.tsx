'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronRight, ChevronLeft, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/store/authStore';
import { useHostelStore } from '../../../src/store/hostelStore';
import toast from 'react-hot-toast';

const step1Schema = z.object({
  name: z.string().min(2, 'Hostel name required'),
  address: z.string().min(5, 'Address required'),
  city: z.string().min(2, 'City required'),
  upi_id: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;

interface FloorConfig {
  floor_number: number;
  room_count: number;
}

interface RoomConfig {
  floor_number: number;
  room_number: string;
  room_type: 'ac' | 'non-ac';
  sharing_type: 'single' | 'double' | 'triple';
  rent_amount: number;
}

const steps = ['Hostel Details', 'Floor Setup', 'Room Configuration', 'Rent Settings'];

export default function HotelSetupWizard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { setHostels, setSelectedHostelId } = useHostelStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1
  const step1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });

  // Step 2
  const [floorCount, setFloorCount] = useState(1);
  const [floors, setFloors] = useState<FloorConfig[]>([{ floor_number: 1, room_count: 5 }]);

  // Step 3 - rooms derived from floors
  const [rooms, setRooms] = useState<RoomConfig[]>([]);

  // Step 4
  const [rentDueDay, setRentDueDay] = useState(5);
  const [lateFee, setLateFee] = useState(0);

  function handleFloorCountChange(count: number) {
    const validCount = Math.max(1, Math.min(20, count));
    setFloorCount(validCount);
    const newFloors: FloorConfig[] = Array.from({ length: validCount }, (_, i) => ({
      floor_number: i + 1,
      room_count: floors[i]?.room_count || 5,
    }));
    setFloors(newFloors);
  }

  function generateRooms() {
    const generated: RoomConfig[] = [];
    floors.forEach(floor => {
      for (let r = 1; r <= floor.room_count; r++) {
        const paddedRoom = r < 10 ? `0${r}` : `${r}`;
        generated.push({
          floor_number: floor.floor_number,
          room_number: `${floor.floor_number}${paddedRoom}`,
          room_type: 'non-ac',
          sharing_type: 'single',
          rent_amount: 5000,
        });
      }
    });
    setRooms(generated);
  }

  function nextStep() {
    if (currentStep === 0) {
      step1.handleSubmit(() => {
        setCurrentStep(1);
      })();
    } else if (currentStep === 1) {
      generateRooms();
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  }

  async function handleFinish() {
    if (!user) return;
    setLoading(true);
    try {
      const step1Data = step1.getValues();

      // Create hostel
      const { data: hostelData, error: hostelError } = await supabase
        .from('hostels')
        .insert({
          owner_id: user.id,
          name: step1Data.name,
          address: step1Data.address,
          city: step1Data.city,
          upi_id: step1Data.upi_id || '',
          total_floors: floorCount,
          rent_due_date_day: rentDueDay,
          late_fee_amount: lateFee,
        })
        .select()
        .single();
      if (hostelError) throw hostelError;

      // Create floors
      const { data: floorData, error: floorError } = await supabase
        .from('floors')
        .insert(floors.map(f => ({ hostel_id: hostelData.id, floor_number: f.floor_number })))
        .select();
      if (floorError) throw floorError;

      // Create rooms
      const floorMap: Record<number, string> = {};
      floorData.forEach((f: any) => { floorMap[f.floor_number] = f.id; });

      const roomsPayload = rooms.map(r => ({
        hostel_id: hostelData.id,
        floor_id: floorMap[r.floor_number],
        room_number: r.room_number,
        room_type: r.room_type,
        sharing_type: r.sharing_type,
        rent_amount: r.rent_amount,
        status: 'available',
      }));

      if (roomsPayload.length === 0) throw new Error('No rooms configured. Please go back and set up rooms.');

      const { error: roomsError } = await supabase.from('rooms').insert(roomsPayload);
      if (roomsError) throw roomsError;

      // Reload hostels
      const { data: allHostels } = await supabase.from('hostels').select('*').eq('owner_id', user.id);
      if (allHostels) {
        setHostels(allHostels);
        setSelectedHostelId(hostelData.id);
      }

      toast.success('Hostel setup complete!');
      router.push('/owner/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-xl mb-3">
            <Building2 size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Hostel Setup Wizard</h1>
          <p className="text-slate-500 text-sm mt-1">Let's set up your hostel in a few quick steps</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  i < currentStep ? 'bg-green-500 text-white' :
                  i === currentStep ? 'bg-primary-600 text-white' :
                  'bg-slate-200 text-slate-400'
                }`}>
                  {i < currentStep ? <Check size={14} /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === currentStep ? 'text-primary-600 font-medium' : 'text-slate-400'}`}>
                  {step}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 transition-colors ${i < currentStep ? 'bg-green-500' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="card p-6 sm:p-8">
          {/* Step 1: Hostel Details */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Hostel Details</h2>
              <div>
                <label className="label">Hostel Name *</label>
                <input {...step1.register('name')} className="input" placeholder="e.g., Sunrise Boys Hostel" />
                {step1.formState.errors.name && <p className="text-red-500 text-xs mt-1">{step1.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Full Address *</label>
                <input {...step1.register('address')} className="input" placeholder="e.g., 45, MG Road, Koramangala" />
                {step1.formState.errors.address && <p className="text-red-500 text-xs mt-1">{step1.formState.errors.address.message}</p>}
              </div>
              <div>
                <label className="label">City *</label>
                <input {...step1.register('city')} className="input" placeholder="e.g., Bengaluru" />
                {step1.formState.errors.city && <p className="text-red-500 text-xs mt-1">{step1.formState.errors.city.message}</p>}
              </div>
              <div>
                <label className="label">UPI ID</label>
                <input {...step1.register('upi_id')} className="input" placeholder="e.g., hostelname@upi" />
                <p className="text-xs text-slate-400 mt-1">Hostellers will use this UPI ID for rent payments</p>
              </div>
            </div>
          )}

          {/* Step 2: Floor Setup */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Floor & Room Setup</h2>
              <div>
                <label className="label">Number of Floors</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={floorCount}
                  onChange={e => handleFloorCountChange(parseInt(e.target.value) || 1)}
                  className="input w-32"
                />
              </div>
              <div className="space-y-3 mt-4">
                <p className="text-sm font-medium text-slate-700">Rooms per floor</p>
                {floors.map((floor, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-700 w-20">Floor {floor.floor_number}</span>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-500">Rooms:</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={floor.room_count}
                        onChange={e => {
                          const updated = [...floors];
                          updated[i] = { ...updated[i], room_count: parseInt(e.target.value) || 1 };
                          setFloors(updated);
                        }}
                        className="input w-20"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Room Configuration */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Room Configuration</h2>
              <p className="text-sm text-slate-500 mb-4">Configure each room's details</p>
              <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
                {rooms.map((room, i) => (
                  <div key={i} className="p-3 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Floor {room.floor_number}</span>
                      <input
                        value={room.room_number}
                        onChange={e => {
                          const updated = [...rooms];
                          updated[i] = { ...updated[i], room_number: e.target.value };
                          setRooms(updated);
                        }}
                        className="input flex-1 text-sm py-1"
                        placeholder="Room number"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Type</label>
                        <select
                          value={room.room_type}
                          onChange={e => {
                            const updated = [...rooms];
                            updated[i] = { ...updated[i], room_type: e.target.value as 'ac' | 'non-ac' };
                            setRooms(updated);
                          }}
                          className="input text-sm py-1"
                        >
                          <option value="non-ac">Non-AC</option>
                          <option value="ac">AC</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Sharing</label>
                        <select
                          value={room.sharing_type}
                          onChange={e => {
                            const updated = [...rooms];
                            updated[i] = { ...updated[i], sharing_type: e.target.value as 'single' | 'double' | 'triple' };
                            setRooms(updated);
                          }}
                          className="input text-sm py-1"
                        >
                          <option value="single">Single</option>
                          <option value="double">Double</option>
                          <option value="triple">Triple</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Rent (₹)</label>
                        <input
                          type="number"
                          value={room.rent_amount}
                          onChange={e => {
                            const updated = [...rooms];
                            updated[i] = { ...updated[i], rent_amount: parseFloat(e.target.value) || 0 };
                            setRooms(updated);
                          }}
                          className="input text-sm py-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Rent Settings */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Rent Settings</h2>
              <div>
                <label className="label">Rent Due Date (Day of Month)</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={rentDueDay}
                  onChange={e => setRentDueDay(parseInt(e.target.value) || 5)}
                  className="input w-24"
                />
                <p className="text-xs text-slate-400 mt-1">Rent will be considered overdue after this day each month (1-28)</p>
              </div>
              <div>
                <label className="label">Late Fee Amount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={lateFee}
                  onChange={e => setLateFee(parseFloat(e.target.value) || 0)}
                  className="input w-32"
                />
                <p className="text-xs text-slate-400 mt-1">This fee will be added automatically for overdue payments</p>
              </div>
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mt-4">
                <p className="text-sm font-medium text-primary-900 mb-2">Setup Summary</p>
                <div className="text-sm text-primary-700 space-y-1">
                  <p>• <strong>{step1.getValues('name')}</strong> in {step1.getValues('city')}</p>
                  <p>• {floorCount} floor{floorCount > 1 ? 's' : ''}, {rooms.length} room{rooms.length > 1 ? 's' : ''} total</p>
                  <p>• Rent due on day <strong>{rentDueDay}</strong> of each month</p>
                  <p>• Late fee: <strong>₹{lateFee}</strong></p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={() => setCurrentStep(s => s - 1)}
              className={`btn-secondary flex items-center gap-2 text-sm ${currentStep === 0 ? 'invisible' : ''}`}
            >
              <ChevronLeft size={16} /> Back
            </button>
            {currentStep < 3 ? (
              <button onClick={nextStep} className="btn-primary flex items-center gap-2 text-sm">
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={handleFinish} className="btn-primary flex items-center gap-2 text-sm" disabled={loading}>
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Setting up...' : 'Complete Setup'}
                {!loading && <Check size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
