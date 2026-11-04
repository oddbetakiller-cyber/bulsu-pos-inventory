// src/pages/AdminPinLogin.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ArrowLeft, Clock, AlertTriangle } from 'lucide-react';
import { rtdb } from '../firebase/firebaseConfig';
import { ref, get, set, update } from 'firebase/database';
import { useAuth } from '../context/AuthContext';
import {
  hashPin,
  verifyPin,
  getLockoutStatus,
  recordFailedAttempt,
  clearFailedAttempts,
} from '../utils/security';

const AdminPinLogin = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockout, setLockout] = useState(() => getLockoutStatus('admin'));
  const navigate = useNavigate();
  const { login } = useAuth();

  // Check lockout on mount and tick countdown
  useEffect(() => {
    if (lockout.isLocked) {
      const interval = setInterval(() => {
        const updated = getLockoutStatus('admin');
        setLockout(updated);
        if (!updated.isLocked) {
          clearInterval(interval);
          setError('');
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockout.isLocked]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (lockout.isLocked) return;

    setError('');
    setIsSubmitting(true);

    try {
      // 1. Fetch Admin record from RTDB system/admin
      const adminRef = ref(rtdb, 'system/admin');
      const snapshot = await get(adminRef);

      let isMatch = false;
      let adminName = 'Administrator';

      if (!snapshot.exists()) {
        // System initialization: If system/admin not yet created, compare against initial default PIN '1234'
        if (pin === '1234') {
          isMatch = true;
          // Seed the initial admin hash into the database
          const initialHash = await hashPin('1234');
          await set(adminRef, {
            name: 'Administrator',
            pinHash: initialHash,
            updatedAt: new Date().toLocaleString(),
          });
        }
      } else {
        const adminData = snapshot.val();
        adminName = adminData.name || 'Administrator';
        const storedPinHash = adminData.pinHash || adminData.pin;

        const check = await verifyPin(pin, storedPinHash);
        isMatch = check.valid;

        // Upgrade legacy plaintext to secure hash if necessary
        if (check.valid && check.needsUpgrade) {
          const newHash = await hashPin(pin);
          await update(adminRef, { pinHash: newHash, pin: null });
        }
      }

      if (isMatch) {
        clearFailedAttempts('admin');
        login({ role: 'admin', name: adminName });
        navigate('/admin/dashboard');
      } else {
        const lockoutStatus = recordFailedAttempt('admin');
        if (lockoutStatus.isLocked) {
          setLockout(lockoutStatus);
          setError(`Too many failed attempts. Admin panel locked for ${lockoutStatus.remainingSeconds} seconds.`);
        } else {
          setError(`Invalid Admin PIN Code! (${lockoutStatus.attemptsLeft} attempt(s) remaining)`);
        }
      }
    } catch (err) {
      console.error('Error during admin login:', err);
      setError('An error occurred during verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#8B1E2D] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border-t-8 border-[#F4D35E]">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-4 text-sm font-bold"
        >
          <ArrowLeft size={16} /> Back to Selection
        </button>

        <div className="w-16 h-16 bg-[#8B1E2D] text-[#F4D35E] rounded-full flex items-center justify-center mx-auto mb-4 shadow">
          <KeyRound size={32} />
        </div>

        <h1 className="text-2xl font-black text-[#8B1E2D] mb-1">ADMIN ACCESS</h1>
        <p className="text-gray-600 text-sm mb-6">Enter Admin PIN to unlock the management portal</p>

        {error && (
          <div className="text-red-700 text-xs font-bold mb-4 bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-left">
            <AlertTriangle size={18} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {lockout.isLocked ? (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 text-amber-900 space-y-2">
            <div className="flex justify-center text-amber-700">
              <Clock size={36} className="animate-pulse" />
            </div>
            <p className="font-black text-sm">Security Lockout Active</p>
            <p className="text-xs text-amber-800">
              Too many failed login attempts. Please wait{' '}
              <strong className="text-amber-950 font-mono text-sm">{lockout.remainingSeconds}s</strong> before
              trying again.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              maxLength={6}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-3xl tracking-widest py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#8B1E2D]"
              required
              disabled={isSubmitting}
              autoFocus
            />
            <button
              type="submit"
              disabled={isSubmitting || !pin}
              className="w-full bg-[#8B1E2D] text-white py-3 rounded-xl font-bold shadow hover:bg-[#6c1723] transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Verifying PIN...' : 'Unlock Admin Panel'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminPinLogin;
