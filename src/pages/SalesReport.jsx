// src/pages/SalesReport.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { rtdb } from '../firebase/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { Receipt, Ban, Printer, CheckSquare, Square, Layers, Search, RefreshCw } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import { useAuth } from '../context/AuthContext';
import { voidSaleAndRestock } from '../utils/posTransactions';

const SalesReport = () => {
  const [sales, setSales] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [batchReceipts, setBatchReceipts] = useState([]);
  const [voidingId, setVoidingId] = useState(null);
  const [voidError, setVoidError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    const salesRef = ref(rtdb, 'sales');
    const unsub = onValue(salesRef, (snapshot) => {
      const data = snapshot.val();
      const list = [];
      for (let id in data) {
        list.push({ id, ...data[id] });
      }
      // Sort newest first and show non-voided sales
      setSales(list.filter((s) => !s.voided).reverse());
    });

    return () => unsub();
  }, []);

  const handleVoid = async (saleId) => {
    if (!window.confirm('Void this receipt and return its items to inventory?')) return;

    setVoidingId(saleId);
    setVoidError('');
    try {
      await voidSaleAndRestock(saleId, user?.name || 'Administrator');
      setSelectedIds((prev) => prev.filter((id) => id !== saleId));
    } catch (error) {
      setVoidError(error.message || 'Could not void this receipt. Please try again.');
    } finally {
      setVoidingId(null);
    }
  };

  const filteredSales = useMemo(() => {
    if (!searchTerm.trim()) return sales;
    const term = searchTerm.toLowerCase();
    return sales.filter(
      (s) =>
        s.id?.toLowerCase().includes(term) ||
        s.cashierName?.toLowerCase().includes(term) ||
        s.paymentReference?.toLowerCase().includes(term) ||
        s.paymentMethod?.toLowerCase().includes(term) ||
        s.items?.some((item) =>
          [item.name, item.sku, item.category].some((value) => value?.toLowerCase().includes(term))
        )
    );
  }, [sales, searchTerm]);

  // Handle single receipt print
  const handlePrintSingle = (sale) => {
    setActiveReceipt(sale);
    setBatchReceipts([]);
    setIsReceiptOpen(true);
  };

  // Handle batch selection
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredSales.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSales.map((s) => s.id));
    }
  };

  // Handle print multiple receipts
  const handlePrintSelected = () => {
    const selectedList = sales.filter((s) => selectedIds.includes(s.id));
    if (selectedList.length === 0) return;
    setActiveReceipt(null);
    setBatchReceipts(selectedList);
    setIsReceiptOpen(true);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto font-sans">
      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#8B1E2D] flex items-center gap-3">
            <Receipt className="text-[#8B1E2D]" /> Sales Report &amp; Transactions
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Audit transactions, reprint receipts (multiple copies), or batch-print multiple sales.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by ID, cashier, item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-xs font-semibold text-gray-800 placeholder-gray-400 focus:border-[#8B1E2D] focus:outline-none shadow-xs"
          />
        </div>
      </div>

      {voidError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
          {voidError}
        </div>
      )}

      {/* Batch Actions Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3.5 border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSelectAll}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            {selectedIds.length > 0 && selectedIds.length === filteredSales.length ? (
              <CheckSquare size={16} className="text-[#8B1E2D]" />
            ) : (
              <Square size={16} className="text-gray-400" />
            )}
            <span>
              {selectedIds.length === filteredSales.length && filteredSales.length > 0
                ? 'Deselect All'
                : 'Select All'}
            </span>
          </button>

          <span className="text-xs font-semibold text-gray-500">
            {selectedIds.length} of {filteredSales.length} selected
          </span>
        </div>

        {/* Batch Print Button */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintSelected}
              className="flex items-center gap-2 rounded-xl bg-[#8B1E2D] px-4 py-2 text-xs font-black text-white hover:bg-[#6c1723] shadow-md transition cursor-pointer"
            >
              <Printer size={15} />
              <span>Print {selectedIds.length} Selected Receipts</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Transactions List */}
      {filteredSales.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Receipt size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="font-bold text-gray-700 text-sm">No Sales Transactions Found</p>
          <p className="text-xs text-gray-400 mt-1">
            Transactions completed by cashiers will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSales.map((sale) => {
            const isSelected = selectedIds.includes(sale.id);

            return (
              <div
                key={sale.id}
                className={`bg-white p-5 sm:p-6 rounded-2xl shadow-sm border transition flex flex-col md:flex-row justify-between items-start gap-4 ${
                  isSelected ? 'border-[#8B1E2D] ring-2 ring-[#8B1E2D]/20 bg-red-50/20' : 'border-gray-200'
                }`}
              >
                {/* Checkbox and Sale Info */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleSelect(sale.id)}
                    className="mt-1 text-gray-400 hover:text-[#8B1E2D] transition cursor-pointer"
                    aria-label={`Select transaction ${sale.id}`}
                  >
                    {isSelected ? (
                      <CheckSquare size={20} className="text-[#8B1E2D]" />
                    ) : (
                      <Square size={20} className="text-gray-300 hover:text-gray-500" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="flex items-center gap-1.5 text-[#8B1E2D] font-black text-base">
                        <Receipt size={18} /> #{sale.id ? sale.id.slice(-8).toUpperCase() : 'N/A'}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({sale.id})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-2 font-medium">
                      <span>Date: <strong className="text-gray-700">{sale.timestamp}</strong></span>
                      <span>•</span>
                      <span>Cashier: <strong className="text-[#8B1E2D]">{sale.cashierName || 'Cashier'}</strong></span>
                      <span>•</span>
                      <span>
                        Payment: <strong className="text-gray-700">{
                          sale.paymentMethod === 'gcash' ? 'GCash' : sale.paymentMethod === 'maya' ? 'Maya' : 'Cash'
                        }</strong>
                      </span>
                      {sale.paymentReference && (
                        <span>Reference: <strong className="font-mono text-gray-700">{sale.paymentReference}</strong></span>
                      )}
                    </div>

                    {/* Itemized preview */}
                    <div className="mt-3 border-t border-gray-100 pt-2.5">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                        Items Purchased ({Array.isArray(sale.items) ? sale.items.reduce((acc, i) => acc + (Number(i.qty) || 0), 0) : 0}):
                      </p>
                      <ul className="text-xs space-y-1 max-w-md">
                        {sale.items?.map((item, idx) => (
                          <li key={idx} className="flex justify-between text-gray-700">
                            <span className="truncate pr-2">{item.name} ×{item.qty}</span>
                            <span className="font-mono font-bold text-gray-900">
                              ₱{(Number(item.price || 0) * Number(item.qty || 1)).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Right side actions and total */}
                <div className="w-full md:w-auto md:text-right flex flex-row md:flex-col justify-between items-end md:items-end border-t md:border-t-0 pt-3 md:pt-0 gap-3">
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 uppercase">Total Amount</p>
                    <p className="text-2xl font-black text-gray-900 font-mono">
                      ₱{Number(sale.total || 0).toFixed(2)}
                    </p>
                    {sale.discountPercentage > 0 && (
                      <span className="inline-block text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold mt-0.5">
                        Discount: {sale.discountPercentage}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    {/* Print Receipt Button */}
                    <button
                      type="button"
                      onClick={() => handlePrintSingle(sale)}
                      className="flex items-center gap-1.5 rounded-xl bg-[#8B1E2D] px-3.5 py-2 text-xs font-black text-white hover:bg-[#6c1723] shadow-sm transition cursor-pointer"
                      title="View & Print Official Receipt (Multiple Copies)"
                    >
                      <Printer size={14} />
                      <span>Print Receipt</span>
                    </button>

                    {/* Void Button */}
                    <button
                      type="button"
                      onClick={() => handleVoid(sale.id)}
                      disabled={voidingId === sale.id}
                      className="flex items-center gap-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 text-xs font-bold border border-red-200 transition cursor-pointer disabled:opacity-50"
                      title="Void this receipt"
                    >
                      <Ban size={14} />
                      <span>{voidingId === sale.id ? 'Restocking…' : 'Void'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Official Receipt Modal for Single or Batch Printing */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={activeReceipt}
        receipts={batchReceipts}
      />
    </div>
  );
};

export default SalesReport;
