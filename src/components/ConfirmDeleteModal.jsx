import React from 'react';
import { Trash2, X } from 'lucide-react';

const ConfirmDeleteModal = ({
  isOpen,
  title = "Confirm Deletion",
  message = "Are you sure you want to delete this? This action cannot be undone.",
  itemName,
  onConfirm,
  onCancel,
  isDeleting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity"
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
        className="relative w-full max-w-md transform rounded-2xl bg-white p-6 text-left shadow-2xl transition-all border border-gray-100"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          maxWidth: '28rem',
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          position: 'relative',
          margin: 'auto',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
      >
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition"
          aria-label="Close"
          disabled={isDeleting}
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <Trash2 size={24} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black text-gray-900" id="modal-headline">
              {title}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {message}
            </p>
            {itemName && (
              <div className="mt-3 rounded-xl bg-gray-50 p-3 border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Target</p>
                <p className="mt-0.5 font-bold text-gray-900 truncate">{itemName}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition focus:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 transition focus:outline-none disabled:opacity-50"
          >
            <Trash2 size={16} />
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
