// src/pages/CashierPinLogin.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  auth,
  googleProvider,
  rtdb,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
} from '../firebase/firebaseConfig';
import { ref, get, update } from 'firebase/database';
import { UserCheck, ArrowLeft, Mail, Lock, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  hashPin,
  verifyPin,
  getLockoutStatus,
  recordFailedAttempt,
  clearFailedAttempts,
} from '../utils/security';

const getGoogleSignInError = (error) => {
  switch (error?.code) {
    case 'auth/unauthorized-domain':
      return `This site is not authorized for Google sign-in. Add "${window.location.hostname}" under Firebase Console → Authentication → Settings → Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'Google sign-in is disabled. Enable the Google provider in Firebase Console → Authentication → Sign-in method.';
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked. Retrying with a redirect…';
    case 'auth/network-request-failed':
      return 'Google sign-in could not reach Firebase. Check your internet connection and try again.';
    case 'database/permission-denied':
    case 'PERMISSION_DENIED':
      return 'Google sign-in succeeded, but Firebase Database blocked access to cashier accounts. Check the Realtime Database rules for authenticated cashier reads.';
    default:
      return error?.message || 'Google sign-in failed. Please try again.';
  }
};

const CashierPinLogin = () => {
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('pin'); // 'pin' or 'email'
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockout, setLockout] = useState({ isLocked: false, remainingSeconds: 0 });
  const navigate = useNavigate();
  const { login } = useAuth();

  const completeGoogleLogin = useCallback(async (credential) => {
    const googleUser = credential.user;
    const userEmail = googleUser.email?.trim().toLowerCase();
    if (!userEmail) {
      throw new Error('The selected Google account did not provide an email address.');
    }

    const snapshot = await get(ref(rtdb, 'cashiers'));
    const cashiersData = snapshot.val() || {};
    const match = Object.entries(cashiersData).find(([, cashier]) =>
      String(cashier.email || '').trim().toLowerCase() === userEmail
    );
    const authorizedCashier = match ? { id: match[0], ...match[1] } : null;

    if (!authorizedCashier) {
      throw new Error(`Google account "${googleUser.email}" is not registered as an authorized cashier. Ask an administrator to add this exact email.`);
    }
    if (authorizedCashier.active === false) {
      throw new Error('This cashier account is inactive. Please contact the administrator.');
    }

    clearFailedAttempts('cashier');
    const cashierDisplayName =
      authorizedCashier.name ||
      [authorizedCashier.firstName, authorizedCashier.lastName].filter(Boolean).join(' ') ||
      googleUser.displayName ||
      googleUser.email;

    login({
      role: 'cashier',
      id: authorizedCashier.id,
      name: cashierDisplayName,
      email: googleUser.email,
    });
    navigate('/cashier/pos');
  }, [login, navigate]);

  useEffect(() => {
    let isMounted = true;
    getRedirectResult(auth)
      .then(async (credential) => {
        if (!credential?.user || !isMounted) return;
        setIsSubmitting(true);
        await completeGoogleLogin(credential);
      })
      .catch((authError) => {
        if (isMounted) setError(getGoogleSignInError(authError));
      })
      .finally(() => {
        if (isMounted) setIsSubmitting(false);
      });

    return () => {
      isMounted = false;
    };
  }, [completeGoogleLogin]);

  // Tick lockout countdown if active
  useEffect(() => {
    const status = getLockoutStatus('cashier');
    setLockout(status);

    if (status.isLocked) {
      const interval = setInterval(() => {
        const updated = getLockoutStatus('cashier');
        setLockout(updated);
        if (!updated.isLocked) {
          clearInterval(interval);
          setError('');
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  const handlePinLogin = async (e) => {
    e.preventDefault();
    if (lockout.isLocked) return;

    setError('');
    setIsSubmitting(true);

    try {
      const snapshot = await get(ref(rtdb, 'cashiers'));
      if (snapshot.exists()) {
        const cashiersData = snapshot.val();
        let matchedCashier = null;
        let upgradeRequired = false;

        for (let id in cashiersData) {
          const c = cashiersData[id];
          const storedPin = c.pinHash || c.pin;
          if (storedPin) {
            const check = await verifyPin(pin, storedPin);
            if (check.valid) {
              matchedCashier = { id, ...c };
              upgradeRequired = check.needsUpgrade;
              break;
            }
          }
        }

        if (matchedCashier) {
          if (matchedCashier.active === false) {
            setError('This cashier account has been deactivated. Please contact the administrator.');
            setIsSubmitting(false);
            return;
          }

          // Silently upgrade legacy plaintext PIN to SHA-256 hash
          if (upgradeRequired) {
            const newHash = await hashPin(pin);
            await update(ref(rtdb, `cashiers/${matchedCashier.id}`), {
              pinHash: newHash,
              pin: null,
            });
          }

          clearFailedAttempts('cashier');

          const cashierDisplayName =
            matchedCashier.name ||
            [matchedCashier.firstName, matchedCashier.lastName].filter(Boolean).join(' ') ||
            'Cashier';

          login({
            role: 'cashier',
            id: matchedCashier.id,
            name: cashierDisplayName,
            email: matchedCashier.email,
          });

          navigate('/cashier/pos');
          return;
        }
      }

      // If no match found, record failed attempt
      const lockoutStatus = recordFailedAttempt('cashier');
      if (lockoutStatus.isLocked) {
        setLockout(lockoutStatus);
        setError(`Too many failed attempts. Terminal locked for ${lockoutStatus.remainingSeconds} seconds.`);
      } else {
        setError(`Invalid Cashier PIN! (${lockoutStatus.attemptsLeft} attempt(s) remaining)`);
      }
    } catch (err) {
      console.error('Error verifying cashier PIN:', err);
      setError('An error occurred during verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (lockout.isLocked) return;

    setError('');
    setIsSubmitting(true);

    try {
      // 1. Check if user matches a cashier in Realtime Database using Email + PIN
      const snapshot = await get(ref(rtdb, 'cashiers'));
      if (snapshot.exists()) {
        const cashiersData = snapshot.val();
        for (let id in cashiersData) {
          const c = cashiersData[id];
          if (c.email && c.email.toLowerCase() === email.trim().toLowerCase()) {
            if (c.active === false) {
              setError('This cashier account has been deactivated. Please contact the administrator.');
              setIsSubmitting(false);
              return;
            }

            const storedPin = c.pinHash || c.pin;
            const check = await verifyPin(password, storedPin);

            if (check.valid) {
              if (check.needsUpgrade) {
                const newHash = await hashPin(password);
                await update(ref(rtdb, `cashiers/${id}`), { pinHash: newHash, pin: null });
              }

              clearFailedAttempts('cashier');

              const cashierDisplayName =
                c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;

              login({
                role: 'cashier',
                id,
                name: cashierDisplayName,
                email: c.email,
              });

              navigate('/cashier/pos');
              return;
            }
          }
        }
      }

      // 2. If not matched in RTDB via PIN, attempt Firebase Auth
      const res = await signInWithEmailAndPassword(auth, email, password);
      let cashierDisplayName = res.user.email;

      // Ensure account is in active cashiers
      if (snapshot.exists()) {
        const cashiersData = snapshot.val();
        for (let id in cashiersData) {
          const c = cashiersData[id];
          if (c.email && c.email.toLowerCase() === email.trim().toLowerCase()) {
            if (c.active === false) {
              setError('This cashier account is inactive. Please contact the administrator.');
              setIsSubmitting(false);
              return;
            }
            cashierDisplayName =
              c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || res.user.email;
            break;
          }
        }
      }

      clearFailedAttempts('cashier');

      login({
        role: 'cashier',
        name: cashierDisplayName,
        email: res.user.email,
      });

      navigate('/cashier/pos');
    } catch (err) {
      const lockoutStatus = recordFailedAttempt('cashier');
      if (lockoutStatus.isLocked) {
        setLockout(lockoutStatus);
        setError(`Terminal locked for ${lockoutStatus.remainingSeconds} seconds.`);
      } else {
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
          setError(`Invalid email or password/PIN. (${lockoutStatus.attemptsLeft} attempt(s) remaining)`);
        } else {
          setError(err.message || 'Failed to sign in. Please check your credentials.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const res = await signInWithPopup(auth, googleProvider);
      await completeGoogleLogin(res);
    } catch (err) {
      if (err.code === 'auth/popup-blocked') {
        setError(getGoogleSignInError(err));
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          setError(getGoogleSignInError(redirectError));
        }
      } else {
        setError(getGoogleSignInError(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#8B1E2D] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-t-8 border-[#F4D35E]">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-4 text-sm font-bold"
        >
          <ArrowLeft size={16} /> Back to Selection
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[#F4D35E] text-[#8B1E2D] rounded-full flex items-center justify-center mx-auto mb-3 shadow">
            <UserCheck size={32} />
          </div>
          <h1 className="text-2xl font-black text-[#8B1E2D]">CASHIER PORTAL</h1>
          <p className="text-gray-600 text-sm">Enter Cashier PIN or credentials to open terminal</p>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 text-xs rounded-xl mb-4 font-semibold text-center border border-red-200 flex items-center gap-2 text-left">
            <AlertTriangle size={16} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {lockout.isLocked ? (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 text-amber-900 text-center space-y-2 mb-4">
            <div className="flex justify-center text-amber-700">
              <Clock size={36} className="animate-pulse" />
            </div>
            <p className="font-black text-sm">Terminal Lockout Active</p>
            <p className="text-xs text-amber-800">
              Too many failed login attempts. Please wait{' '}
              <strong className="text-amber-950 font-mono text-sm">{lockout.remainingSeconds}s</strong> before
              trying again.
            </p>
          </div>
        ) : (
          <>
            <div className="flex border-b mb-6">
              <button
                className={`flex-1 pb-2 font-bold cursor-pointer transition ${
                  authMode === 'pin' ? 'border-b-4 border-[#8B1E2D] text-[#8B1E2D]' : 'text-gray-400'
                }`}
                onClick={() => {
                  setAuthMode('pin');
                  setError('');
                }}
              >
                PIN Login
              </button>
              <button
                className={`flex-1 pb-2 font-bold cursor-pointer transition ${
                  authMode === 'email' ? 'border-b-4 border-[#8B1E2D] text-[#8B1E2D]' : 'text-gray-400'
                }`}
                onClick={() => {
                  setAuthMode('email');
                  setError('');
                }}
              >
                Email / Google
              </button>
            </div>

            {authMode === 'pin' ? (
              <form onSubmit={handlePinLogin} className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-3xl tracking-widest py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#8B1E2D]"
                  required
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !pin}
                  className="w-full bg-[#8B1E2D] text-white py-3 rounded-xl font-bold shadow hover:bg-[#6c1723] transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Verifying PIN...' : 'Open Cashier Terminal'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input
                      type="email"
                      placeholder="Registered Cashier Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input
                      type="password"
                      placeholder="Password or 4-digit PIN"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !email || !password}
                    className="w-full bg-[#8B1E2D] text-white py-2.5 rounded-lg font-bold text-sm shadow hover:bg-[#6c1723] disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'Signing In...' : 'Sign In with Email'}
                  </button>
                </form>

                <div className="relative my-4 text-center">
                  <span className="bg-white px-2 text-xs text-gray-400">OR</span>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                  className="w-full border py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    className="w-4 h-4"
                  />{' '}
                  Sign in with Google
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CashierPinLogin;
