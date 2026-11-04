// src/pages/CashierManagement.jsx
import React, { useState, useEffect } from 'react';
import { rtdb } from '../firebase/firebaseConfig';
import { ref, onValue, push, remove, update, set } from 'firebase/database';
import {
  UserPlus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  User,
  Mail,
  Key,
  CheckCircle,
  AlertCircle,
  X,
  Lock,
  Search,
} from 'lucide-react';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { hashPin, verifyPin } from '../utils/security';

const CashierManagement = () => {
  const [cashiers, setCashiers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');

  // Reset PIN modal state
  const [cashierToResetPin, setCashierToResetPin] = useState(null);
  const [newCashierPin, setNewCashierPin] = useState('');
  const [resetPinError, setResetPinError] = useState('');
  const [isResettingPin, setIsResettingPin] = useState(false);

  const [cashierToDelete, setCashierToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    const cashiersRef = ref(rtdb, 'cashiers');
    const unsubscribe = onValue(cashiersRef, (snapshot) => {
      const data = snapshot.val();
      const list = [];
      for (let id in data) list.push({ id, ...data[id] });
      setCashiers(list);
    });
    return () => unsubscribe();
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredCashiers = normalizedSearch
    ? cashiers.filter((cashier) => {
        const searchableText = [
          cashier.name,
          cashier.firstName,
          cashier.middleName,
          cashier.lastName,
          cashier.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
    : cashiers;

  const resetForm = () => {
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setEmail('');
    setPin('');
    setFormError('');
  };

  const addCashier = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanFirst = firstName.trim();
    const cleanMiddle = middleName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (!cleanFirst || !cleanLast) {
      setFormError('Please enter both First Name and Last Name.');
      return;
    }

    if (!cleanEmail) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6) {
      setFormError('PIN code must be between 4 and 6 digits.');
      return;
    }

    // Check for duplicate email
    const duplicateEmail = cashiers.some(
      (c) => c.email && c.email.toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      setFormError('A cashier account with this email address already exists.');
      return;
    }

    // Check for duplicate PIN against all existing cashiers
    for (const c of cashiers) {
      const storedPin = c.pinHash || c.pin;
      if (storedPin) {
        const check = await verifyPin(cleanPin, storedPin);
        if (check.valid) {
          setFormError('This PIN code is already in use by another cashier. Please choose another PIN.');
          return;
        }
      }
    }

    const fullName = `${cleanFirst}${cleanMiddle ? ' ' + cleanMiddle : ''} ${cleanLast}`.replace(/\s+/g, ' ');

    try {
      const hashedPin = await hashPin(cleanPin);
      const newRef = push(ref(rtdb, 'cashiers'));
      await set(newRef, {
        firstName: cleanFirst,
        middleName: cleanMiddle,
        lastName: cleanLast,
        name: fullName,
        email: cleanEmail,
        pinHash: hashedPin,
        active: true,
        createdAt: new Date().toLocaleString(),
      });

      resetForm();
      setIsAddModalOpen(false);
      setFormSuccess(`Cashier "${fullName}" was successfully added!`);
      setTimeout(() => setFormSuccess(''), 5000);
    } catch (err) {
      console.error('Failed to create cashier:', err);
      setFormError('Failed to save cashier. Please try again.');
    }
  };

  const handleResetPinSubmit = async (e) => {
    e.preventDefault();
    if (!cashierToResetPin) return;

    setResetPinError('');
    if (newCashierPin.length < 4 || newCashierPin.length > 6) {
      setResetPinError('New PIN must be between 4 and 6 digits.');
      return;
    }

    setIsResettingPin(true);
    try {
      const newHash = await hashPin(newCashierPin);
      await update(ref(rtdb, `cashiers/${cashierToResetPin.id}`), {
        pinHash: newHash,
        pin: null, // Remove plaintext PIN
        updatedAt: new Date().toLocaleString(),
      });

      const name = cashierToResetPin.name || 'Cashier';
      setFormSuccess(`PIN for "${name}" has been successfully updated.`);
      setTimeout(() => setFormSuccess(''), 5000);

      setCashierToResetPin(null);
      setNewCashierPin('');
    } catch (err) {
      console.error('Failed to reset cashier PIN:', err);
      setResetPinError('Failed to reset PIN. Please try again.');
    } finally {
      setIsResettingPin(false);
    }
  };

  const toggleActiveStatus = (id, currentStatus) => {
    update(ref(rtdb, `cashiers/${id}`), { active: !currentStatus });
  };

  const confirmDelete = async () => {
    if (!cashierToDelete) return;
    try {
      setIsDeleting(true);
      await remove(ref(rtdb, `cashiers/${cashierToDelete.id}`));
    } catch (err) {
      console.error('Failed to delete cashier:', err);
    } finally {
      setIsDeleting(false);
      setCashierToDelete(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header with Title and Add Cashier Button */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#8B1E2D]">
            Cashier Account Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage cashier credentials with cryptographic PIN protection.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-[#8B1E2D] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#6c1723] w-fit cursor-pointer"
        >
          <UserPlus size={18} />
          <span>Add New Cashier</span>
        </button>
      </div>

      {/* Success Notification */}
      {formSuccess && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm">
          <CheckCircle size={20} className="shrink-0 text-emerald-600" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Search Cashier Accounts */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-[#8B1E2D] focus-within:ring-2 focus-within:ring-[#8B1E2D]/10">
          <Search size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by cashier name or email"
            aria-label="Search cashier accounts by name or email"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear cashier search"
              className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <p className="text-xs font-semibold text-gray-500" aria-live="polite">
          Showing {filteredCashiers.length} of {cashiers.length} cashier{cashiers.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Cashiers Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#8B1E2D] text-xs font-bold uppercase tracking-wider text-white">
              <tr>
                <th className="p-4">Cashier Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Security PIN</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Toggle Active</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {cashiers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No cashier accounts found. Click <strong>"Add New Cashier"</strong> to create one.
                  </td>
                </tr>
              ) : filteredCashiers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No cashier accounts match <strong>"{searchTerm.trim()}"</strong>.
                  </td>
                </tr>
              ) : (
                filteredCashiers.map((c) => {
                  const displayName =
                    c.name ||
                    [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ') ||
                    'Unnamed Cashier';

                  return (
                    <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Name */}
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{displayName}</div>
                        {(c.firstName || c.lastName) && (
                          <div className="text-xs text-gray-400">
                            {[c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')}
                          </div>
                        )}
                      </td>

                      {/* Email */}
                      <td className="p-4 text-gray-600">
                        {c.email ? (
                          <span className="flex items-center gap-1.5 font-medium">
                            <Mail size={14} className="text-gray-400" />
                            {c.email}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No email</span>
                        )}
                      </td>

                      {/* PIN Protection */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                            <Lock size={12} className="text-[#8B1E2D]" /> ••••
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCashierToResetPin(c);
                              setNewCashierPin('');
                              setResetPinError('');
                            }}
                            className="text-xs text-[#8B1E2D] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            title="Reset this cashier's PIN"
                          >
                            <Key size={13} /> Reset PIN
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-black tracking-wide ${
                            c.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {c.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>

                      {/* Toggle Active */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => toggleActiveStatus(c.id, c.active)}
                          title={c.active ? 'Set to Inactive' : 'Set to Active'}
                          aria-label="Toggle cashier active status"
                          className="text-[#8B1E2D] hover:scale-110 transition cursor-pointer"
                        >
                          {c.active ? (
                            <ToggleRight size={32} className="inline text-emerald-600" />
                          ) : (
                            <ToggleLeft size={32} className="inline text-gray-400" />
                          )}
                        </button>
                      </td>

                      {/* Delete Action */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setCashierToDelete(c)}
                          title="Delete Cashier"
                          aria-label="Delete Cashier"
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Cashier Modal Form */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsAddModalOpen(false);
              resetForm();
            }
          }}
        >
          <div
            className="relative w-full max-w-lg transform rounded-2xl bg-white p-6 shadow-2xl transition-all border border-gray-100 max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-add-cashier-title"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B1E2D]/10 text-[#8B1E2D]">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2
                    id="modal-add-cashier-title"
                    className="text-lg font-bold text-gray-900"
                  >
                    Add New Cashier
                  </h2>
                  <p className="text-xs text-gray-500">
                    Enter details to generate POS access credentials.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Notification inside Modal */}
            {formError && (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={addCashier} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. Juan"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-[#8B1E2D] focus:outline-none focus:ring-2 focus:ring-[#8B1E2D]/20"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {/* Middle Name */}
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
                    Middle Name <span className="text-xs font-normal text-gray-400">(Optional)</span>
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. Santos"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-[#8B1E2D] focus:outline-none focus:ring-2 focus:ring-[#8B1E2D]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Last Name */}
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="e.g. Dela Cruz"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-[#8B1E2D] focus:outline-none focus:ring-2 focus:ring-[#8B1E2D]/20"
                    required
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="email"
                    placeholder="e.g. juan.delacruz@bulsu.edu.ph"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-[#8B1E2D] focus:outline-none focus:ring-2 focus:ring-[#8B1E2D]/20"
                    required
                  />
                </div>
              </div>

              {/* PIN Code */}
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
                  PIN Code <span className="text-red-500">*</span>{' '}
                  <span className="text-xs font-normal text-gray-400">(4-6 digits, hashed securely)</span>
                </label>
                <div className="relative">
                  <Key size={16} className="absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    minLength={4}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 text-sm tracking-widest focus:border-[#8B1E2D] focus:outline-none focus:ring-2 focus:ring-[#8B1E2D]/20"
                    required
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetForm();
                  }}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-[#8B1E2D] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#6c1723] cursor-pointer"
                >
                  <UserPlus size={16} />
                  <span>Save Cashier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Cashier PIN Modal */}
      {cashierToResetPin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCashierToResetPin(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border-t-4 border-[#8B1E2D] relative">
            <button
              onClick={() => setCashierToResetPin(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 transition"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-[#8B1E2D]/10 text-[#8B1E2D] flex items-center justify-center">
                <Key size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900">Reset Cashier PIN</h2>
                <p className="text-xs text-gray-500">{cashierToResetPin.name || 'Cashier'}</p>
              </div>
            </div>

            {resetPinError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-600" />
                <span>{resetPinError}</span>
              </div>
            )}

            <form onSubmit={handleResetPinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Enter New PIN (4-6 digits)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  minLength={4}
                  placeholder="••••"
                  value={newCashierPin}
                  onChange={(e) => setNewCashierPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-2xl tracking-widest py-2.5 border rounded-xl focus:border-[#8B1E2D] focus:outline-none"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCashierToResetPin(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPin || !newCashierPin}
                  className="flex-1 py-2.5 rounded-xl bg-[#8B1E2D] text-white text-xs font-bold hover:bg-[#6c1723] transition shadow disabled:opacity-50 cursor-pointer"
                >
                  {isResettingPin ? 'Updating...' : 'Update PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(cashierToDelete)}
        title="Delete Cashier Account"
        message="Are you sure you want to delete this cashier account? This action cannot be undone."
        itemName={
          cashierToDelete?.name ||
          [cashierToDelete?.firstName, cashierToDelete?.lastName].filter(Boolean).join(' ')
        }
        onConfirm={confirmDelete}
        onCancel={() => setCashierToDelete(null)}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default CashierManagement;
