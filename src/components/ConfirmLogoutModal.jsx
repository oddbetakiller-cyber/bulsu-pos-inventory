// src/components/ConfirmLogoutModal.jsx
import React from 'react';
import { LogOut, X } from 'lucide-react';

const ConfirmLogoutModal = ({ isOpen, onConfirm, onCancel, isLoggingOut = false, message = 'Are you sure you want to logout?' }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
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
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoggingOut) {
          onCancel();
        }
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center border-t-4 border-[#8B1E2D]"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          maxWidth: '24rem',
          width: '100%',
          padding: '1.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          borderTop: '5px solid #8B1E2D',
          position: 'relative',
          margin: 'auto',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-logout-title"
      >
        <button
          onClick={onCancel}
          disabled={isLoggingOut}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition cursor-pointer"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#8B1E2D]/10 text-[#8B1E2D] mb-4 shadow-sm">
          <LogOut size={28} />
        </div>

        <h3 id="modal-logout-title" className="text-xl font-black text-gray-900 mb-1">
          Confirm Logout
        </h3>
        <p className="text-sm text-gray-500 mb-6 font-medium">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoggingOut}
            className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoggingOut}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B1E2D] hover:bg-[#6c1723] text-white py-2.5 text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-50"
          >
            <LogOut size={16} />
            {isLoggingOut ? 'Logging out...' : 'Yes, Logout'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmLogoutModal;
