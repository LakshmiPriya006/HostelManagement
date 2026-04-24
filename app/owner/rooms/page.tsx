'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Users, User, Wind, Snowflake, History, Bell, UserMinus, Loader2, Search, Filter, X, ChevronDown } from 'lucide-react';
import { supabase } from '../../../src/services/supabase';
import { useHostelStore } from '../../../src/store/hostelStore';
import { useAuthStore } from '../../../src/store/authStore';
import Modal from '../../../src/components/shared/Modal';
import ConfirmModal from '../../../src/components/shared/ConfirmModal';
import EmptyState from '../../../src/components/shared/EmptyState';
import { RoomGridSkeleton } from '../../../src/components/shared/LoadingSkeleton';
import { formatCurrency, formatDate, getCurrentMonth, getCurrentYear } from '../../../src/utils';
import { createNotification } from '../../../src/services/notifications';
import toast from 'react-hot-toast';
import type { Room, Floor, Hosteller, RentPayment, RoomHistory } from '../../../src/types';
import AddHostellerModal from '../../../src/components/owner/AddHostellerModal';

interface FloorWithRooms {
  floor: Floor;
  rooms: Room[];
}

type SortKey = 'room_number' | 'rent_amount' | 'status';

export default function RoomManager() {
  const { selectedHostelId, getSelectedHostel } = useHostelStore();
  const { user } = useAuthStore();
  const hostel = getSelectedHostel();
  const [floorsWithRooms, setFloorsWithRooms] = useState<FloorWithRooms[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomHostellers, setRoomHostellers] = useState<Hosteller[]>([]);
  const [roomRents, setRoomRents] = useState<RentPayment[]>([]);
  const [roomHistory, setRoomHistory] = useState<RoomHistory[]>([]);
  const [roomDetailTab, setRoomDetailTab] = useState<'current' | 'history'>('current');
  const [showAddHosteller, setShowAddHosteller] = useState(false);
  const [moveOutHosteller, setMoveOutHosteller] = useState<Hosteller | null>(null);
  const [moveOutLoading, setMoveOutLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterSharing, setFilterSharing] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterFloor, setFilterFloor] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('room_number');
  const [showFilters, setShowFilters] = useState(false);

  const allRooms = useMemo(() => floorsWithRooms.flatMap(f => f.rooms), [floorsWithRooms]);

  const filteredRooms = useMemo(() => {
    let rooms = allRooms;
    if (search.trim()) {
      const q = search.toLowerCase();
      rooms = rooms.filter(r => r.room_number.toLowerCase().includes(q));
    }
    if (filterType.length) rooms = rooms.filter(r => filterType.includes(r.room_type));
    if (filterSharing.length) rooms = rooms.filter(r => filterSharing.includes(r.sharing_type));
    if (filterStatus.length) rooms = rooms.filter(r => filterStatus.includes(r.status));
    if (filterFloor.length) {
      const floorIds = floorsWithRooms
        .filter(f => filterFloor.includes(String(f.floor.floor_number)))
        .map(f => f.floor.id);
      rooms = rooms.filter(r => floorIds.includes(r.floor_id));
    }
    return [...rooms].sort((a, b) => {
      if (sortKey === 'rent_amount') return b.rent_amount - a.rent_amount;
      if (sortKey === 'status') return a.status.localeCompare(b.status);
      return a.room_number.localeCompare(b.room_number, undefined, { numeric: true });
    });
  }, [allRooms, search, filterType, filterSharing, filterStatus, filterFloor, sortKey, floorsWithRooms]);

  const activeFilterCount = filterType.length + filterSharing.length + filterStatus.length + filterFloor.length;

  function toggleFilter(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  }

  function clearFilters() {
    setFilterType([]);
    setFilterSharing([]);
    setFilterStatus([]);
    setFilterFloor([]);
    setSearch('');
  }

  const load = useCallback(async () => {
    if (!selectedHostelId) return;
    setLoading(true);
    const { data: floors } = await supabase.from('floors').select('*').eq('hostel_id', selectedHostelId).order('floor_number');
    const { data: rooms } = await supabase.from('rooms').select('*').eq('hostel_id', selectedHostelId);
    if (floors && rooms) {
      const fwr: FloorWithRooms[] = floors.map((f: Floor) => ({
        floor: f,
        rooms: rooms.filter((r: Room) => r.floor_id === f.id).sort((a, b) => a.room_number.localeCompare(b.room_number)),
      }));
      setFloorsWithRooms(fwr);
    }
    setLoading(false);
  }, [selectedHostelId]);

  useEffect(() => { load(); }, [load]);

  async function openRoomDetail(room: Room) {
    setSelectedRoom(room);
    setRoomDetailTab('current');
    const [hosRes, rentRes, histRes] = await Promise.all([
      supabase.from('hostellers').select('*').eq('room_id', room.id).eq('status', 'active'),
      supabase.from('rent_payments').select('*').eq('room_id', room.id)
        .eq('month', getCurrentMonth()).eq('year', getCurrentYear()),
      supabase.from('room_history').select('*').eq('room_id', room.id).order('archived_at', { ascending: false }),
    ]);
    setRoomHostellers(hosRes.data || []);
    setRoomRents(rentRes.data || []);
    setRoomHistory(histRes.data || []);
  }

  async function handleMoveOut() {
    if (!moveOutHosteller || !selectedRoom) return;
    setMoveOutLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('hostellers').update({ status: 'moved_out', move_out_date: today }).eq('id', moveOutHosteller.id);
      await supabase.from('room_history').insert({
        room_id: selectedRoom.id,
        hosteller_id: moveOutHosteller.id,
        hosteller_name: moveOutHosteller.name,
        move_in_date: moveOutHosteller.move_in_date,
        move_out_date: today,
      });
      const remaining = roomHostellers.filter(h => h.id !== moveOutHosteller.id);
      const maxCapacity = selectedRoom.sharing_type === 'single' ? 1 : selectedRoom.sharing_type === 'double' ? 2 : 3;
      const newStatus = remaining.length === 0 ? 'available' : remaining.length < maxCapacity ? 'partial' : 'occupied';
      await supabase.from('rooms').update({ status: newStatus }).eq('id', selectedRoom.id);
      toast.success(`${moveOutHosteller.name} marked as moved out`);
      setMoveOutHosteller(null);
      load();
      await openRoomDetail({ ...selectedRoom, status: newStatus });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMoveOutLoading(false);
    }
  }

  async function sendReminder(hosteller: Hosteller) {
    await createNotification(hosteller.id, 'hosteller', 'rent_reminder',
      `Reminder: Your rent for ${hostel?.name} is due. Please pay at the earliest.`);
    toast.success(`Reminder sent to ${hosteller.name}`);
  }

  const statusConfig = {
    available: { bg: 'bg-success-50 border-success-100 hover:bg-success-100', dot: 'bg-success-500', text: 'text-success-700', label: 'Vacant' },
    occupied: { bg: 'bg-danger-50 border-danger-100 hover:bg-danger-100', dot: 'bg-danger-500', text: 'text-danger-700', label: 'Full' },
    partial: { bg: 'bg-warning-50 border-warning-100 hover:bg-warning-100', dot: 'bg-warning-500', text: 'text-warning-700', label: 'Partial' },
  };

  if (loading) return <div className="p-6"><RoomGridSkeleton /></div>;
  if (!selectedHostelId) return <div className="p-6 text-ink-400 text-center">No hostel selected</div>;

  const floorNumbers = floorsWithRooms.map(f => String(f.floor.floor_number));

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="section-title">Room Manager</h1>
          <p className="section-subtitle">{allRooms.length} rooms · {floorsWithRooms.length} floors</p>
        </div>
        <button onClick={() => setShowAddHosteller(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Hosteller
        </button>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search room number..."
            className="input pl-9 pr-4"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${activeFilterCount > 0 ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-ink-200 text-ink-600 hover:border-primary-300'}`}
          >
            <Filter size={15} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-white text-primary-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>
            )}
            <ChevronDown size={13} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {showFilters && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl border border-ink-200 shadow-card-lg z-30 p-4 animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-ink-800">Filters</span>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-danger-600 hover:underline flex items-center gap-1">
                    <X size={12} /> Clear all
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Room Type</p>
                  <div className="flex gap-2 flex-wrap">
                    {['ac', 'non-ac'].map(v => (
                      <button key={v} onClick={() => toggleFilter(filterType, v, setFilterType)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${filterType.includes(v) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-ink-600 border-ink-200 hover:border-primary-300'}`}>
                        {v === 'ac' ? 'AC' : 'Non-AC'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Sharing Type</p>
                  <div className="flex gap-2 flex-wrap">
                    {['single', 'double', 'triple'].map(v => (
                      <button key={v} onClick={() => toggleFilter(filterSharing, v, setFilterSharing)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors capitalize ${filterSharing.includes(v) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-ink-600 border-ink-200 hover:border-primary-300'}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Occupancy</p>
                  <div className="flex gap-2 flex-wrap">
                    {[{ v: 'available', l: 'Vacant' }, { v: 'partial', l: 'Partial' }, { v: 'occupied', l: 'Full' }].map(({ v, l }) => (
                      <button key={v} onClick={() => toggleFilter(filterStatus, v, setFilterStatus)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${filterStatus.includes(v) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-ink-600 border-ink-200 hover:border-primary-300'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {floorNumbers.length > 1 && (
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Floor</p>
                    <div className="flex gap-2 flex-wrap">
                      {floorNumbers.map(v => (
                        <button key={v} onClick={() => toggleFilter(filterFloor, v, setFilterFloor)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${filterFloor.includes(v) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-ink-600 border-ink-200 hover:border-primary-300'}`}>
                          Floor {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Sort By</p>
                  <div className="flex gap-2 flex-wrap">
                    {(['room_number', 'rent_amount', 'status'] as SortKey[]).map(k => (
                      <button key={k} onClick={() => setSortKey(k)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${sortKey === k ? 'bg-ink-800 text-white border-ink-800' : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'}`}>
                        {k === 'room_number' ? 'Room No.' : k === 'rent_amount' ? 'Rent' : 'Status'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          { label: 'Total', val: allRooms.length, color: 'bg-ink-100 text-ink-700' },
          { label: 'Vacant', val: allRooms.filter(r => r.status === 'available').length, color: 'bg-success-100 text-success-700' },
          { label: 'Full', val: allRooms.filter(r => r.status === 'occupied').length, color: 'bg-danger-100 text-danger-700' },
          { label: 'Partial', val: allRooms.filter(r => r.status === 'partial').length, color: 'bg-warning-100 text-warning-700' },
        ].map(({ label, val, color }) => (
          <div key={label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${color}`}>
            <span>{label}:</span><span className="font-bold">{val}</span>
          </div>
        ))}
        {(search || activeFilterCount > 0) && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary-100 text-primary-700">
            Showing {filteredRooms.length} results
          </div>
        )}
      </div>

      {floorsWithRooms.length === 0 ? (
        <EmptyState icon={Users} title="No rooms yet" description="Set up your hostel first to see rooms here." />
      ) : filteredRooms.length === 0 ? (
        <div className="card p-10 text-center">
          <Search size={32} className="text-ink-300 mx-auto mb-3" />
          <p className="font-semibold text-ink-600">No rooms match your search</p>
          <p className="text-sm text-ink-400 mt-1">Try adjusting your filters or search term</p>
          <button onClick={clearFilters} className="btn-secondary text-sm mt-4">Clear Filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredRooms.map(room => {
            const cfg = statusConfig[room.status];
            const floorNum = floorsWithRooms.find(f => f.floor.id === room.floor_id)?.floor.floor_number;
            return (
              <button
                key={room.id}
                onClick={() => openRoomDetail(room)}
                className={`relative p-3 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] hover:shadow-card-md ${cfg.bg}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-base font-bold ${cfg.text}`}>{room.room_number}</span>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                </div>
                <div className="flex items-center gap-1 mb-1">
                  {room.room_type === 'ac' ? <Snowflake size={10} className="text-primary-500" /> : <Wind size={10} className="text-ink-400" />}
                  <span className="text-xs text-ink-500 uppercase font-medium">{room.room_type}</span>
                </div>
                <div className="text-xs text-ink-500 capitalize">{room.sharing_type}</div>
                <div className="text-xs font-bold text-ink-700 mt-1.5">{formatCurrency(room.rent_amount)}</div>
                {floorNum !== undefined && (
                  <div className="absolute top-2 right-2 text-[10px] text-ink-400 font-medium">F{floorNum}</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedRoom && (
        <Modal isOpen={!!selectedRoom} onClose={() => setSelectedRoom(null)} title={`Room ${selectedRoom.room_number}`} size="lg">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="badge-blue capitalize">{selectedRoom.room_type}</span>
            <span className="badge-gray capitalize">{selectedRoom.sharing_type}</span>
            <span className={selectedRoom.status === 'available' ? 'badge-green' : selectedRoom.status === 'occupied' ? 'badge-red' : 'badge-yellow'}>
              {statusConfig[selectedRoom.status].label}
            </span>
            <span className="badge-gray">{formatCurrency(selectedRoom.rent_amount)}/mo</span>
          </div>

          <div className="tab-bar mb-4">
            {(['current', 'history'] as const).map(tab => (
              <button key={tab} onClick={() => setRoomDetailTab(tab)}
                className={`tab-item ${roomDetailTab === tab ? 'tab-item-active' : 'tab-item-inactive'}`}>
                {tab === 'current' ? 'Current Residents' : 'History'}
              </button>
            ))}
          </div>

          {roomDetailTab === 'current' ? (
            <div>
              {roomHostellers.length === 0 ? (
                <div className="text-center py-8">
                  <User size={32} className="text-ink-300 mx-auto mb-2" />
                  <p className="text-ink-400 text-sm">No current residents</p>
                  <button onClick={() => { setSelectedRoom(null); setShowAddHosteller(true); }} className="btn-primary text-sm mt-3">
                    Add Hosteller
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {roomHostellers.map(h => {
                    const rent = roomRents.find(r => r.hosteller_id === h.id);
                    return (
                      <div key={h.id} className="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary-700">{h.name.slice(0, 2).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-ink-800">{h.name}</p>
                            <p className="text-xs text-ink-400">Since {formatDate(h.move_in_date)}</p>
                            {rent && (
                              <span className={`text-xs font-semibold ${rent.status === 'paid' ? 'text-success-600' : rent.status === 'overdue' ? 'text-danger-600' : 'text-warning-600'}`}>
                                Rent: {rent.status}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {rent?.status !== 'paid' && (
                            <button onClick={() => sendReminder(h)} className="p-1.5 text-warning-600 hover:bg-warning-50 rounded-lg transition-colors" title="Send reminder">
                              <Bell size={15} />
                            </button>
                          )}
                          <button onClick={() => setMoveOutHosteller(h)} className="p-1.5 text-danger-500 hover:bg-danger-50 rounded-lg transition-colors" title="Mark as moved out">
                            <UserMinus size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              {roomHistory.length === 0 ? (
                <p className="text-sm text-ink-400 py-6 text-center">No history yet</p>
              ) : (
                <div className="space-y-2">
                  {roomHistory.map(h => (
                    <div key={h.id} className="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <History size={16} className="text-ink-400" />
                        <div>
                          <p className="text-sm font-medium text-ink-700">{h.hosteller_name}</p>
                          <p className="text-xs text-ink-400">
                            {formatDate(h.move_in_date || '')} — {h.move_out_date ? formatDate(h.move_out_date) : 'Present'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      <ConfirmModal
        isOpen={!!moveOutHosteller}
        onClose={() => setMoveOutHosteller(null)}
        onConfirm={handleMoveOut}
        title="Mark as Moved Out"
        message={`Are you sure you want to mark ${moveOutHosteller?.name} as moved out? This will update room occupancy and archive the record.`}
        confirmLabel="Mark as Moved Out"
        isDestructive
        loading={moveOutLoading}
      />

      {showAddHosteller && (
        <AddHostellerModal
          isOpen={showAddHosteller}
          onClose={() => setShowAddHosteller(false)}
          onSuccess={() => { setShowAddHosteller(false); load(); }}
          rooms={allRooms}
        />
      )}
    </div>
  );
}
