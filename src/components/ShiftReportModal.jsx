import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Check, Printer, X } from 'lucide-react';

const formatPeso = (value) =>
  `₱${(Number(value) || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString() : '—';

const ShiftReportModal = ({ reading, onClose }) => {
  const reportRef = useRef(null);
  const isClosing = reading?.type === 'Z';
  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `BulSU-${isClosing ? 'Z' : 'X'}-Reading-${reading?.createdAt || Date.now()}`,
    pageStyle: `
      @page { size: auto; margin: 10mm; }
      @media print {
        body { background: #fff !important; }
        .shift-reading-paper { border: 0 !important; box-shadow: none !important; }
        .shift-no-print { display: none !important; }
      }
    `,
  });

  if (!reading) return null;

  const metrics = [
    ['Completed sales', reading.salesCount],
    ['Total sales', formatPeso(reading.totalSales)],
    ['Cash sales', formatPeso(reading.cashSales)],
    ['GCash sales', formatPeso(reading.gcashSales)],
    ['Maya sales', formatPeso(reading.mayaSales)],
    ['Opening float', formatPeso(reading.openingFloat)],
    ['Expected cash in drawer', formatPeso(reading.expectedCash)],
    ['Voided receipts', `${reading.voidedCount} (${formatPeso(reading.voidedTotal)})`],
  ];

  if (isClosing) {
    metrics.push(
      ['Counted cash', formatPeso(reading.countedCash)],
      ['Cash over / short', formatPeso(reading.cashDifference)]
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
        <div className="shift-no-print flex items-center justify-between border-b bg-gray-50 px-6 py-4">
          <h3 className="font-black text-sm uppercase tracking-wider text-gray-800">
            {isClosing ? 'Z Reading · Shift Closed' : 'X Reading · Shift Snapshot'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700"
            aria-label="Close shift reading"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5 sm:p-7">
          <div ref={reportRef} className="shift-reading-paper rounded-2xl border border-gray-200 bg-white p-6 font-mono text-sm text-gray-800">
            <div className="border-b border-dashed border-gray-300 pb-4 text-center">
              <p className="font-black uppercase tracking-wide text-[#8B1E2D]">BulSU POS</p>
              <h2 className="mt-1 text-lg font-black">{isClosing ? 'Z Reading' : 'X Reading'}</h2>
              <p className="mt-1 text-xs text-gray-500">
                {isClosing ? 'Final shift close report' : 'Current shift sales snapshot'}
              </p>
            </div>

            <dl className="space-y-2 border-b border-dashed border-gray-300 py-4 text-xs">
              <div className="flex justify-between gap-4"><dt>Cashier</dt><dd className="text-right font-bold">{reading.cashierName || 'Cashier'}</dd></div>
              <div className="flex justify-between gap-4"><dt>Shift ID</dt><dd className="text-right">{reading.shiftId ? reading.shiftId.slice(-8).toUpperCase() : '—'}</dd></div>
              <div className="flex justify-between gap-4"><dt>Opened</dt><dd className="text-right">{formatDateTime(reading.openedAt)}</dd></div>
              <div className="flex justify-between gap-4"><dt>{isClosing ? 'Closed' : 'Reading time'}</dt><dd className="text-right">{formatDateTime(reading.createdAt)}</dd></div>
            </dl>

            <dl className="space-y-2 py-4 text-xs">
              {metrics.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className={label === 'Cash over / short' ? 'font-black' : 'text-gray-600'}>{label}</dt>
                  <dd className={label === 'Cash over / short' ? 'font-black text-[#8B1E2D]' : 'text-right font-bold'}>{value}</dd>
                </div>
              ))}
            </dl>

            <p className="border-t border-dashed border-gray-300 pt-3 text-center text-[10px] text-gray-400">
              {isClosing ? 'End of shift report' : 'X readings do not close the shift'}
            </p>
          </div>
        </div>

        <div className="shift-no-print flex justify-between gap-3 border-t bg-gray-50 px-6 py-4">
          <button type="button" onClick={onClose} className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100">
            <Check size={16} className="text-emerald-600" /> Done
          </button>
          <button type="button" onClick={handlePrint} className="flex items-center gap-2 rounded-xl bg-[#8B1E2D] px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-[#6c1723]">
            <Printer size={16} /> Print Reading
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftReportModal;
