// src/components/ReceiptModal.jsx
import { useRef, useState, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Check, X, Receipt, Layers, FileText } from 'lucide-react';
import bulsuLogo from '../assets/bulsu logo.jpg';

const COPY_LABELS = [
  'Customer Copy',
  'Store / Cashier Copy',
  'Accounting Copy',
  'Audit / Archive Copy',
];

const getCopyLabel = (copyIndex, totalCopies) => {
  if (totalCopies === 1) return 'Customer Copy';
  if (copyIndex < COPY_LABELS.length) return COPY_LABELS[copyIndex];
  return `Copy #${copyIndex + 1}`;
};

const DISCOUNT_LABELS = {
  senior: 'Senior Citizen',
  pwd: 'PWD',
  student: 'Student',
};

const formatPeso = (val) => {
  const num = Number(val) || 0;
  return `₱${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Single printable paper layout for a receipt copy
const ReceiptPaperView = ({ receipt, copyIdx, totalCopies }) => {
  const totalItemsCount = Array.isArray(receipt.items)
    ? receipt.items.reduce((acc, item) => acc + (Number(item.qty) || 0), 0)
    : 0;

  const copyLabel = getCopyLabel(copyIdx, totalCopies);
  const paymentMethod = receipt.paymentMethod || 'cash';
  const paymentLabel = paymentMethod === 'gcash'
    ? 'GCash'
    : paymentMethod === 'maya'
      ? 'Maya'
      : 'Cash';
  const discountLabel = DISCOUNT_LABELS[receipt.discountType] ||
    (Number(receipt.discountPercentage) > 0 ? 'Special Discount' : '');

  return (
    <div className="printable-receipt mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-sm border border-gray-200 font-mono text-xs text-gray-800">
      {/* BulSU Logo & Header */}
      <div className="text-center pb-3 border-b border-dashed border-gray-300">
        <img
          src={bulsuLogo}
          alt="BulSU Logo"
          className="h-16 w-16 mx-auto object-contain mb-2 rounded-full"
        />
        <h2 className="font-black text-sm text-[#8B1E2D] tracking-tight uppercase">
          Bulacan State University
        </h2>
        <p className="text-[11px] text-gray-600 font-sans font-semibold">
          POS &amp; Inventory Management System
        </p>
        <p className="text-[10px] text-gray-400 font-sans">
          City of Malolos, Bulacan, Philippines
        </p>

        <div className="mt-2 flex flex-col items-center justify-center gap-1">
          <span className="inline-block rounded-md bg-gray-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-700">
            Official Sales Receipt
          </span>
          <span
            className={`inline-block rounded px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${
              copyIdx === 0
                ? 'bg-[#8B1E2D] text-white'
                : copyIdx === 1
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-blue-100 text-blue-900 border border-blue-300'
            }`}
          >
            • {copyLabel} •
          </span>
        </div>

        {receipt.voided && (
          <div className="mt-2 rounded-md bg-red-100 border border-red-300 py-1 px-2 text-center text-xs font-black text-red-700 uppercase tracking-widest">
            ⚠ VOIDED TRANSACTION - NOT VALID ⚠
          </div>
        )}
      </div>

      {/* Transaction Metadata */}
      <div className="py-2.5 space-y-1 border-b border-dashed border-gray-300 text-[11px]">
        <div className="flex justify-between">
          <span className="text-gray-500">Receipt No:</span>
          <span className="font-bold text-gray-900">
            #{receipt.id ? receipt.id.slice(-8).toUpperCase() : 'N/A'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Date &amp; Time:</span>
          <span className="font-semibold text-gray-700">
            {receipt.timestamp || new Date().toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Cashier:</span>
          <span className="font-bold text-[#8B1E2D]">
            {receipt.cashierName || 'Cashier'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Payment Method:</span>
          <span className="font-bold text-gray-800">{paymentLabel}</span>
        </div>
        {receipt.paymentReference && (
          <div className="flex justify-between gap-3">
            <span className="shrink-0 text-gray-500">Payment Reference:</span>
            <span className="break-all text-right font-bold text-gray-800">{receipt.paymentReference}</span>
          </div>
        )}
        {discountLabel && (
          <>
            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-gray-500">Discount Type:</span>
              <span className="text-right font-bold text-gray-800">{discountLabel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-gray-500">Discount ID:</span>
              <span className="break-all text-right font-bold text-gray-800">
                {receipt.discountId || 'Not recorded'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Itemized Table */}
      <div className="py-3 border-b border-dashed border-gray-300">
        <div className="grid grid-cols-12 font-bold text-gray-500 text-[10px] uppercase pb-1.5 border-b border-gray-100">
          <span className="col-span-6">Item</span>
          <span className="col-span-2 text-center">Qty</span>
          <span className="col-span-2 text-right">Price</span>
          <span className="col-span-2 text-right">Total</span>
        </div>

        <div className="divide-y divide-gray-100 py-1 space-y-1">
          {receipt.items &&
            receipt.items.map((item, idx) => {
              const qty = Number(item.qty) || 1;
              const price = Number(item.price) || 0;
              const itemTotal = qty * price;
              return (
                <div
                  key={idx}
                  className="grid grid-cols-12 py-1 items-center text-[11px]"
                >
                  <div className="col-span-6 min-w-0 pr-1">
                    <p className="truncate font-semibold text-gray-800">{item.name}</p>
                    {(item.sku || item.category) && (
                      <p className="truncate text-[9px] text-gray-400">
                        {item.sku ? `SKU: ${item.sku}` : ''}{item.sku && item.category ? ' · ' : ''}{item.category || ''}
                      </p>
                    )}
                  </div>
                  <span className="col-span-2 text-center text-gray-600">
                    x{qty}
                  </span>
                  <span className="col-span-2 text-right text-gray-500">
                    ₱{price.toFixed(2)}
                  </span>
                  <span className="col-span-2 text-right font-bold text-gray-900">
                    ₱{itemTotal.toFixed(2)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Calculations & Totals */}
      <div className="py-3 space-y-1.5 border-b border-dashed border-gray-300 text-[11px]">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal ({totalItemsCount} items):</span>
          <span>{formatPeso(receipt.subtotal || receipt.total)}</span>
        </div>

        {receipt.discountPercentage > 0 && (
          <div className="flex justify-between text-emerald-700 font-semibold">
            <span>Special Discount ({receipt.discountPercentage}%):</span>
            <span>
              -{formatPeso(
                receipt.discountAmount ||
                  ((receipt.subtotal || receipt.total) *
                    (receipt.discountPercentage / 100))
              )}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center text-sm font-black text-gray-900 border-t border-gray-200 pt-2">
          <span>TOTAL AMOUNT DUE:</span>
          <span className="text-[#8B1E2D] text-base">
            {formatPeso(receipt.total)}
          </span>
        </div>

        {/* Cash & Change info */}
        {receipt.cashReceived !== undefined && receipt.cashReceived > 0 && (
          <>
            <div className="flex justify-between text-gray-600 pt-1">
              <span>Cash Tendered:</span>
              <span className="font-semibold">
                {formatPeso(receipt.cashReceived)}
              </span>
            </div>
            <div className="flex justify-between text-gray-900 font-bold">
              <span>Change Due:</span>
              <span className="text-emerald-700 font-black">
                {formatPeso(receipt.change || 0)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Receipt Footer Note */}
      <div className="pt-4 text-center text-[10px] text-gray-400 space-y-1 font-sans">
        <p className="font-bold text-gray-600 uppercase tracking-wider">
          *** THANK YOU FOR SHOPPING AT BULSU! ***
        </p>
        <p>Keep this official receipt for your records.</p>
        <div className="flex justify-between items-center text-[9px] text-gray-400 font-mono pt-2 border-t border-dashed border-gray-200 mt-2">
          <span>Ref: {receipt.id ? receipt.id.slice(-8).toUpperCase() : 'N/A'}</span>
          <span className="font-semibold text-gray-500 uppercase">
            {copyLabel} {totalCopies > 1 ? `(${copyIdx + 1}/${totalCopies})` : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

const ReceiptModal = ({ isOpen, onClose, receipt, receipts, initialCopies }) => {
  const printRef = useRef(null);

  // Normalize single receipt or list of receipts
  const receiptList = useMemo(() => {
    if (Array.isArray(receipts) && receipts.length > 0) {
      return receipts.filter(Boolean);
    }
    if (receipt) {
      return [receipt];
    }
    return [];
  }, [receipt, receipts]);

  // Persistent copy count: defaults to 2 (Customer Copy & Store Copy)
  const [copies, setCopies] = useState(() => {
    if (initialCopies && initialCopies >= 1) return initialCopies;
    try {
      const saved = localStorage.getItem('bulsu_receipt_copies');
      const parsed = parseInt(saved, 10);
      return !isNaN(parsed) && parsed >= 1 && parsed <= 10 ? parsed : 2;
    } catch {
      return 2;
    }
  });

  const handleCopiesChange = (newCount) => {
    const val = Math.max(1, Math.min(10, newCount));
    setCopies(val);
    try {
      localStorage.setItem('bulsu_receipt_copies', String(val));
    } catch {
      // localStorage may fail in private mode
    }
  };

  // Generate flat list of printable items: each receipt printed `copies` times
  const printItems = useMemo(() => {
    const items = [];
    receiptList.forEach((rcpt, rcptIdx) => {
      for (let c = 0; c < copies; c++) {
        items.push({
          receipt: rcpt,
          copyIdx: c,
          totalCopies: copies,
          receiptIndex: rcptIdx,
          key: `${rcpt.id || rcptIdx}-copy-${c}`,
        });
      }
    });
    return items;
  }, [receiptList, copies]);

  const documentTitle = useMemo(() => {
    if (receiptList.length === 1 && receiptList[0]?.id) {
      return `BulSU-Receipt-${receiptList[0].id.slice(-8).toUpperCase()}`;
    }
    return `BulSU-Receipts-${receiptList.length}-transactions`;
  }, [receiptList]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle,
    pageStyle: `
      @page {
        size: auto;
        margin: 6mm 4mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .printable-receipt {
          margin: 0 auto !important;
          box-shadow: none !important;
          border: 1px dashed #d1d5db !important;
        }
        .receipt-page-break {
          page-break-after: always !important;
          break-after: page !important;
        }
        .receipt-page-break:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .receipt-no-print {
          display: none !important;
        }
      }
    `,
  });

  if (!isOpen || receiptList.length === 0) return null;

  const isMultiBatch = receiptList.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto"
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
        className="relative w-full max-w-lg transform rounded-3xl bg-white shadow-2xl transition-all border border-gray-100 my-6"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1.5rem',
          maxWidth: '32rem',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          position: 'relative',
          margin: 'auto',
        }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-50 rounded-t-3xl">
          <div className="flex items-center gap-2 text-[#8B1E2D]">
            <Receipt size={20} />
            <span className="font-black text-sm uppercase tracking-wider text-gray-800">
              {isMultiBatch
                ? `Transaction Receipts (${receiptList.length} Transactions)`
                : 'Transaction Receipt'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Copies Control Bar */}
        <div className="bg-amber-50/60 border-b border-amber-200/60 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Copies Stepper */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Layers size={14} className="text-[#8B1E2D]" />
                Copies to Print:
              </span>
              <div className="inline-flex items-center rounded-xl border border-gray-300 bg-white shadow-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleCopiesChange(copies - 1)}
                  disabled={copies <= 1}
                  className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed font-black text-sm cursor-pointer transition"
                  title="Decrease copies"
                >
                  −
                </button>
                <span className="w-8 text-center text-xs font-black text-[#8B1E2D]">
                  {copies}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopiesChange(copies + 1)}
                  disabled={copies >= 10}
                  className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed font-black text-sm cursor-pointer transition"
                  title="Increase copies"
                >
                  +
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleCopiesChange(1)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                  copies === 1
                    ? 'bg-[#8B1E2D] text-white border-[#8B1E2D] shadow-xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                1 Copy
              </button>

              <button
                type="button"
                onClick={() => handleCopiesChange(2)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                  copies === 2
                    ? 'bg-[#8B1E2D] text-white border-[#8B1E2D] shadow-xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span>2 Copies</span>
                <span className="text-[9px] opacity-80">(Cust + Store)</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopiesChange(3)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                  copies === 3
                    ? 'bg-[#8B1E2D] text-white border-[#8B1E2D] shadow-xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span>3 Copies</span>
                <span className="text-[9px] opacity-80">(+ Acct)</span>
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
            <span>
              {copies === 1 && 'Will print 1 copy (Customer Copy).'}
              {copies === 2 && 'Will print 2 copies: Customer Copy & Store Copy.'}
              {copies === 3 && 'Will print 3 copies: Customer, Store, & Accounting.'}
              {copies > 3 && `Will print ${copies} copies with designated copy labels.`}
            </span>
            {isMultiBatch && (
              <span className="font-bold text-[#8B1E2D]">
                Total prints: {receiptList.length * copies} ({receiptList.length} receipts × {copies} copies)
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Receipt Body (Preview area containing all print copies) */}
        <div className="max-h-[62vh] overflow-y-auto p-6 bg-gray-100/70">
          <div ref={printRef} className="print-copies-wrapper space-y-4">
            {printItems.map((item, index) => {
              const isLastItem = index === printItems.length - 1;
              const isNewReceipt =
                index > 0 &&
                item.receiptIndex !== printItems[index - 1].receiptIndex;

              return (
                <div
                  key={item.key}
                  className={!isLastItem ? 'receipt-page-break' : ''}
                >
                  {/* On-screen visual divider between copies or different receipts */}
                  {index > 0 && (
                    <div className="receipt-no-print my-6 flex items-center justify-center gap-2 select-none">
                      <span className="border-t-2 border-dashed border-gray-300 flex-1"></span>
                      <span
                        className={`flex items-center gap-1.5 font-mono font-bold text-[10px] px-3 py-1 rounded-full shadow-xs ${
                          isNewReceipt
                            ? 'bg-[#8B1E2D] text-white'
                            : 'bg-gray-200 text-gray-700 border border-gray-300'
                        }`}
                      >
                        {isNewReceipt ? (
                          <>
                            <FileText size={12} />
                            <span>
                              NEXT TRANSACTION #{item.receipt.id ? item.receipt.id.slice(-8).toUpperCase() : 'N/A'}
                            </span>
                          </>
                        ) : (
                          <span>
                            ✂ TEAR / CUT LINE — NEXT: {getCopyLabel(item.copyIdx, item.totalCopies).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="border-t-2 border-dashed border-gray-300 flex-1"></span>
                    </div>
                  )}

                  <ReceiptPaperView
                    receipt={item.receipt}
                    copyIdx={item.copyIdx}
                    totalCopies={item.totalCopies}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between gap-3 border-t px-6 py-4 bg-gray-50 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition shadow-sm cursor-pointer"
          >
            <Check size={16} className="text-emerald-600" />
            <span>Done / Close</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl bg-[#8B1E2D] px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-[#6c1723] transition cursor-pointer"
          >
            <Printer size={16} />
            <span>
              {isMultiBatch
                ? `Print All ${receiptList.length} Receipts (${copies} ${copies > 1 ? 'copies each' : 'copy each'})`
                : copies > 1
                ? `Print ${copies} Copies (${getCopyLabel(0, copies)} + ${getCopyLabel(1, copies)})`
                : 'Print Receipt (1 Copy)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
