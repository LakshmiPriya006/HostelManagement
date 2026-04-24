import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', isDestructive = false, loading = false
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${isDestructive ? 'bg-red-100' : 'bg-yellow-100'}`}>
          <AlertTriangle size={18} className={isDestructive ? 'text-red-600' : 'text-yellow-600'} />
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="btn-secondary text-sm" disabled={loading}>Cancel</button>
        <button
          onClick={onConfirm}
          className={isDestructive ? 'btn-danger text-sm' : 'btn-primary text-sm'}
          disabled={loading}
        >
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
