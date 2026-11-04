// src/pages/VoidReceipts.jsx
import { useState, useEffect } from 'react';
import { rtdb } from '../firebase/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { AlertOctagon, Printer, Receipt } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import { useAuth } from '../context/AuthContext';
import { restockVoidedSale } from '../utils/posTransactions';

const VoidReceipts = () => {
  const [voids, setVoids] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [restockingId, setRestockingId] = useState(null);
  const [restockError, setRestockError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    const salesRef = ref(rtdb, 'sales');
    const unsub = onValue(salesRef, (snapshot) => {
      const data = snapshot.val();
      const list = [];
      for (let id in data) {
        if (data[id].voided) list.push({ id, ...data[id] });
      }
      setVoids(list.reverse());
    });

    return () => unsub();
  }, []);

  const handlePrintVoid = (v) => {
    setSelectedReceipt(v);
    setIsReceiptOpen(true);
  };

  const handleRestockLegacyVoid = async (sale) => {
    const itemList = (sale.items || []).map((item) => `${item.name} ×${item.qty}`).join(', ');
    if (!window.confirm(`Add these receipt items back to inventory?\n\n${itemList}\n\nOnly continue if they have not already been restocked.`)) return;

    setRestockingId(sale.id);
    setRestockError('');
    try {
      await restockVoidedSale(sale.id, user?.name || 'Administrator');
    } catch (error) {
      setRestockError(error.message || 'Could not restock this receipt.');
    } finally {
      setRestockingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto font-sans">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-[#8B1E2D] flex items-center gap-3">
          <AlertOctagon className="text-red-600" /> Voided Receipts Log
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Review voided transactions and print official void audit slips (multiple copies).
        </p>
      </div>

      {restockError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
          {restockError}
        </div>
      )}

      {voids.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Receipt size={36} className="mx-auto text-gray-300 mb-2" />
          <p className="font-bold text-gray-700 text-sm">No Voided Receipts</p>
          <p className="text-xs text-gray-400 mt-1">
            Any receipts voided during audits or cancellations will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {voids.map((v) => (
            <div
              key={v.id}
              className="bg-white border border-red-200 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-red-300 transition"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-black text-red-900 text-base">
                    Voided Transaction: #{v.id ? v.id.slice(-8).toUpperCase() : 'N/A'}
                  </span>
                  <span className="bg-red-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                    VOIDED
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Cashier on Duty: <strong className="text-gray-800">{v.cashierName || 'Cashier'}</strong>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Timestamp: {v.timestamp}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Voided by: <strong>{v.voidedBy || 'Administrator'}</strong>
                  {v.inventoryRestocked
                    ? <span className="ml-2 font-bold text-emerald-700">• Inventory restocked</span>
                    : <span className="ml-2 font-bold text-amber-700">• Restock status not recorded</span>}
                </p>
                {Array.isArray(v.items) && v.items.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Items: {v.items.map((i) => `${i.name} (×${i.qty})`).join(', ')}
                  </p>
                )}
              </div>

              <div className="text-left sm:text-right w-full sm:w-auto flex sm:flex-col justify-between items-center sm:items-end border-t sm:border-t-0 pt-3 sm:pt-0">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Voided Total</p>
                  <p className="text-xl font-black text-gray-900 font-mono">
                    ₱{Number(v.total || 0).toFixed(2)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestockLegacyVoid(v)}
                  disabled={Boolean(v.inventoryRestocked) || restockingId === v.id}
                  className="mt-2 mr-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  title={v.inventoryRestocked ? 'Inventory already restocked' : 'Restock this legacy voided receipt'}
                >
                  {restockingId === v.id ? 'Restocking…' : v.inventoryRestocked ? 'Restocked' : 'Restock Items'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintVoid(v)}
                  className="mt-2 flex items-center gap-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 px-3.5 py-2 text-xs font-black border border-red-300 transition shadow-xs cursor-pointer"
                  title="Print Void Slip / Receipt (multiple copies)"
                >
                  <Printer size={14} />
                  <span>Print Void Slip</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Official Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={selectedReceipt}
      />
    </div>
  );
};

export default VoidReceipts;
