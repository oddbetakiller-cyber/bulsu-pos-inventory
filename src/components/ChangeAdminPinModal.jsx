// src/components/ChangeAdminPinModal.jsx
import React, { useState } from 'react';
import { KeyRound, X, CheckCircle, AlertTriangle, Lock } from 'lucide-react';
import { rtdb } from '../firebase/firebaseConfig';
import { ref, get, update } from 'firebase/database';
import { hashPin, verifyPin } from '../utils/security';

const ChangeAdminPinModal = ({ isOpen, onClose }) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPin.length < 4 || newPin.length > 6) {
      setError('New PIN must be between 4 and 6 digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setError('New PIN and confirmation PIN do not match.');
      return;
    }

    if (currentPin === newPin) {
      setError('New PIN must be different from current PIN.');
      return;
    }

    setIsSaving(true);

    try {
      const adminRef = ref(rtdb, 'system/admin');
      const snapshot = await get(adminRef);

      let currentHash = null;
      if (snapshot.exists()) {
        const data = snapshot.val();
        currentHash = data.pinHash || data.pin;
      }

      // If no admin record exists yet, compare against legacy default '1234'
      const check = await verifyPin(currentPin, currentHash || '1234');
      if (!check.valid) {
        setError('Current Admin PIN is incorrect.');
        setIsSaving(false);
        return;
      }

      // Hash the new PIN and save
      const newHash = await hashPin(newPin);
      await update(adminRef, {
        pinHash: newHash,
        pin: null, // ensure plaintext is cleared
        updatedAt: new Date().toLocaleString(),
      });

      setSuccess('Admin PIN successfully updated!');
      setTimeout(() => {
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setSuccess('');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to change admin PIN:', err);
      setError('Failed to update PIN. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border-t-4 border-[#8B1E2D] relative"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          maxWidth: '24rem',
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          borderTop: '5px solid #8B1E2D',
          position: 'relative',
          margin: 'auto',
        }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 transition"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-[#8B1E2D]/10 text-[#8B1E2D] flex items-center justify-center">
            <KeyRound size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">Change Admin PIN</h2>
            <p className="text-xs text-gray-500">Update master security PIN code</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle size={16} className="shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Current PIN</label>
            <input
              type="password"
              maxLength={6}
              placeholder="••••"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-xl tracking-widest py-2 border rounded-xl focus:border-[#8B1E2D] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">New PIN (4-6 digits)</label>
            <input
              type="password"
              maxLength={6}
              placeholder="••••"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-xl tracking-widest py-2 border rounded-xl focus:border-[#8B1E2D] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Confirm New PIN</label>
            <input
              type="password"
              maxLength={6}
              placeholder="••••"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-xl tracking-widest py-2 border rounded-xl focus:border-[#8B1E2D] focus:outline-none"
              required
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-[#8B1E2D] text-white text-xs font-bold hover:bg-[#6c1723] transition shadow disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Updating...' : 'Save New PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangeAdminPinModal;
