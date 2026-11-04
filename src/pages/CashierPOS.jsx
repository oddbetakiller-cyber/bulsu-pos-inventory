// src/pages/CashierPOS.jsx
import { useState, useEffect } from 'react';
import { rtdb } from '../firebase/firebaseConfig';
import { ref, onValue, push } from 'firebase/database';
import {
  ShoppingCart,
  Receipt,
  Percent,
  LogOut,
  Plus,
  Minus,
  Trash2,
  Search,
  Coins,
  FileText,
  History,
  Printer,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReceiptModal from '../components/ReceiptModal';
import ShiftReportModal from '../components/ShiftReportModal';
import ConfirmLogoutModal from '../components/ConfirmLogoutModal';
import { useAuth } from '../context/AuthContext';
import {
  checkoutWithStock,
  closeCashierShift,
  createXReading,
  openCashierShift,
  summarizeShift,
} from '../utils/posTransactions';

const DISCOUNT_LABELS = {
  senior: 'Senior Citizen',
  pwd: 'PWD',
  student: 'Student',
};

const CashierPOS = () => {
  const [stocks, setStocks] = useState([]);
  const [cart, setCart] = useState([]);
  const [discountType, setDiscountType] = useState('none'); // 'none', 'pwd', 'senior', 'student'
  const [discountId, setDiscountId] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(() => {
    try {
      const saved = sessionStorage.getItem('bulsu_last_receipt');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [allSales, setAllSales] = useState([]);
  const [cashierShifts, setCashierShifts] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('');
  const [closingCashCount, setClosingCashCount] = useState('');
  const [shiftError, setShiftError] = useState('');
  const [shiftBusy, setShiftBusy] = useState(false);
  const [readingToShow, setReadingToShow] = useState(null);
  const [isRecentModalOpen, setIsRecentModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { user, logout } = useAuth();
  const currentCashier = user || { name: 'Cashier' };
  const cashierKey = currentCashier.id || currentCashier.email?.toLowerCase() || currentCashier.name || 'cashier';
  const navigate = useNavigate();

  const handleConfirmLogout = async () => {
    setIsLogoutModalOpen(false);
    navigate('/', { replace: true });
    await logout();
  };

  // Real-time stock listener
  useEffect(() => {
    const stocksRef = ref(rtdb, 'stocks');
    const unsubscribe = onValue(stocksRef, (snapshot) => {
      const data = snapshot.val();
      const list = [];
      if (data) {
        for (let id in data) {
          if (id === '__posOperations') continue;
          list.push({ id, ...data[id] });
        }
      }
      setStocks(list);
    });
    return () => unsubscribe();
  }, []);

  // Listen to recent sales for quick receipt reprinting
  useEffect(() => {
    const salesRef = ref(rtdb, 'sales');
    const unsubscribe = onValue(salesRef, (snapshot) => {
      const data = snapshot.val();
      const list = [];
      for (let id in data || {}) {
        list.push({ id, ...data[id] });
      }
      setAllSales(list);
      const nonVoided = list.filter((sale) => !sale.voided).reverse();
      if (!lastReceipt && nonVoided.length > 0) {
        setLastReceipt(nonVoided[0]);
      }
    });
    return () => unsubscribe();
  }, [lastReceipt]);

  useEffect(() => {
    const shiftsRef = ref(rtdb, 'shifts');
    const unsubscribe = onValue(
      shiftsRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const matchingShifts = Object.values(data)
          .filter((shift) => shift?.cashierKey === cashierKey)
          .sort((a, b) => Number(b.openedAt) - Number(a.openedAt));
        setCashierShifts(matchingShifts);
        const openShift = matchingShifts.find((shift) => shift.status === 'open') || null;
        setCurrentShift(openShift);
        setShiftLoading(false);
      },
      (error) => {
        setShiftError(`Unable to load shift status: ${error.message}`);
        setShiftLoading(false);
      }
    );
    return () => unsubscribe();
  }, [cashierKey]);

  const recentSales = currentShift
    ? allSales.filter((sale) => sale.shiftId === currentShift.id && !sale.voided).reverse().slice(0, 15)
    : [];
  const shiftSummary = currentShift ? summarizeShift(currentShift, allSales) : null;
  const readingHistory = cashierShifts
    .flatMap((shift) => Object.values(shift.readings || {}))
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .slice(0, 8);

  // Add product to cart
  const addToCart = (product) => {
    if (isCheckingOut || product.quantity <= 0) return;
    setCheckoutError('');
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      if (existing.qty < product.quantity) {
        setCart(
          cart.map((item) =>
            item.id === product.id ? { ...item, qty: item.qty + 1 } : item
          )
        );
      }
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  // Increase item quantity
  const increaseQty = (productId) => {
    if (isCheckingOut) return;
    const stockItem = stocks.find((s) => s.id === productId);
    const existing = cart.find((item) => item.id === productId);
    if (!existing || !stockItem) return;

    if (existing.qty < stockItem.quantity) {
      setCheckoutError('');
      setCart(
        cart.map((item) =>
          item.id === productId ? { ...item, qty: item.qty + 1 } : item
        )
      );
    }
  };

  // Decrease item quantity
  const decreaseQty = (productId) => {
    if (isCheckingOut) return;
    const existing = cart.find((item) => item.id === productId);
    if (!existing) return;
    setCheckoutError('');

    if (existing.qty > 1) {
      setCart(
        cart.map((item) =>
          item.id === productId ? { ...item, qty: item.qty - 1 } : item
        )
      );
    } else {
      removeFromCart(productId);
    }
  };

  // Remove single item from cart
  const removeFromCart = (productId) => {
    if (isCheckingOut) return;
    setCart(cart.filter((item) => item.id !== productId));
    setCheckoutError('');
  };

  // Clear entire cart
  const clearCart = () => {
    if (isCheckingOut) return;
    setCart([]);
    setDiscountType('none');
    setDiscountId('');
    setCashTendered('');
    setPaymentReference('');
    setCheckoutError('');
  };

  // Financial calculations
  const subtotal = cart.reduce(
    (acc, item) => acc + (Number(item.price) || 0) * item.qty,
    0
  );

  let discountRate = 0;
  if (discountType === 'pwd' || discountType === 'senior') {
    discountRate = 0.2; // 20%
  } else if (discountType === 'student') {
    discountRate = 0.1; // 10%
  }

  const discountAmount = subtotal * discountRate;
  const total = Math.max(0, subtotal - discountAmount);

  // Cash tendered & change calculation
  const numericCash = parseFloat(cashTendered) || 0;
  const change = paymentMethod === 'cash' && numericCash >= total ? numericCash - total : 0;
  const isCashInsufficient =
    paymentMethod === 'cash' && cashTendered !== '' && numericCash < total && total > 0;

  // Search by product name, SKU, or category.
  const filteredStocks = stocks.filter((product) =>
    [product.name, product.sku, product.category]
      .some((value) => (value || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Quick cash buttons helper
  const handleQuickCash = (amount) => {
    if (amount === 'exact') {
      setCashTendered(total.toFixed(2));
    } else {
      setCashTendered(Number(amount).toFixed(2));
    }
    setCheckoutError('');
  };

  // Process checkout and issue official receipt
  const handleOpenShift = async (event) => {
    event.preventDefault();
    const amount = Number(openingFloat);
    if (!Number.isFinite(amount) || amount < 0) {
      setShiftError('Enter a valid opening cash float.');
      return;
    }

    setShiftBusy(true);
    setShiftError('');
    try {
      const shift = await openCashierShift({
        cashierKey,
        cashierId: currentCashier.id,
        cashierName: currentCashier.name || 'Cashier',
        openingFloat: amount,
      });
      setCurrentShift(shift);
      setOpeningFloat('');
    } catch (error) {
      setShiftError(error.message || 'Could not open the shift. Please try again.');
    } finally {
      setShiftBusy(false);
    }
  };

  const handleXReading = async () => {
    if (!currentShift) return;
    setShiftBusy(true);
    setShiftError('');
    try {
      const reading = await createXReading(currentShift.id, cashierKey);
      setIsShiftModalOpen(false);
      setReadingToShow(reading);
    } catch (error) {
      setShiftError(error.message || 'Could not create the X reading.');
    } finally {
      setShiftBusy(false);
    }
  };

  const handleCloseShift = async (event) => {
    event.preventDefault();
    if (!currentShift) return;
    if (cart.length > 0) {
      setShiftError('Complete or clear the current cart before closing the shift.');
      return;
    }
    const amount = Number(closingCashCount);
    if (closingCashCount === '' || !Number.isFinite(amount) || amount < 0) {
      setShiftError('Enter the cash counted in the drawer to close the shift.');
      return;
    }

    setShiftBusy(true);
    setShiftError('');
    try {
      const reading = await closeCashierShift({
        shiftId: currentShift.id,
        cashierKey,
        countedCash: amount,
      });
      setCurrentShift(null);
      setClosingCashCount('');
      setIsShiftModalOpen(false);
      setReadingToShow(reading);
    } catch (error) {
      setShiftError(error.message || 'Could not close the shift. Please try again.');
    } finally {
      setShiftBusy(false);
    }
  };

  const handleCheckout = async () => {
    if (isCheckingOut) return;
    if (cart.length === 0) {
      setCheckoutError('Please add items to your cart before checking out.');
      return;
    }
    if (shiftLoading || !currentShift) {
      setCheckoutError('Open a cashier shift before checking out.');
      return;
    }
    if (discountType !== 'none' && !discountId.trim()) {
      setCheckoutError(`Enter the ${DISCOUNT_LABELS[discountType] || 'discount'} ID number.`);
      return;
    }
    if (paymentMethod !== 'cash' && !paymentReference.trim()) {
      setCheckoutError(`Enter the ${paymentMethod === 'gcash' ? 'GCash' : 'Maya'} reference number.`);
      return;
    }

    const effectiveCash = paymentMethod === 'cash'
      ? (cashTendered === '' ? total : numericCash)
      : 0;
    if (paymentMethod === 'cash' && (!Number.isFinite(effectiveCash) || effectiveCash < total)) {
      setCheckoutError(
        `Insufficient cash tendered. Total is ₱${total.toFixed(2)}.`
      );
      return;
    }

    const calculatedChange = paymentMethod === 'cash' ? effectiveCash - total : 0;
    const salesRef = push(ref(rtdb, 'sales'));
    const receiptData = {
      id: salesRef.key,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku || '',
        category: item.category || '',
        price: Number(item.price) || 0,
        qty: item.qty,
      })),
      subtotal,
      discountType,
      discountId: discountType === 'none' ? null : discountId.trim(),
      discountPercentage: discountRate * 100,
      discountAmount,
      total,
      paymentMethod,
      paymentReference: paymentMethod === 'cash' ? null : paymentReference.trim(),
      cashReceived: effectiveCash,
      change: calculatedChange,
      cashierName: currentCashier.name || 'Cashier',
      cashierId: currentCashier.id || null,
      shiftId: currentShift.id,
      timestamp: new Date().toLocaleString(),
      timestampMs: new Date().getTime(),
      voided: false,
    };

    setIsCheckingOut(true);
    setCheckoutError('');
    try {
      const committedReceipt = await checkoutWithStock({
        cashierKey,
        shiftId: currentShift.id,
        shiftSnapshot: currentShift,
        saleId: salesRef.key,
        receipt: receiptData,
        items: receiptData.items,
      });

      setActiveReceipt(committedReceipt);
      setLastReceipt(committedReceipt);
      try {
        sessionStorage.setItem('bulsu_last_receipt', JSON.stringify(committedReceipt));
      } catch {
        // sessionStorage may fail in private mode
      }
      setIsReceiptOpen(true);
      setCart([]);
      setDiscountType('none');
      setDiscountId('');
      setCashTendered('');
      setPaymentMethod('cash');
      setPaymentReference('');
    } catch (error) {
      setCheckoutError(error.message || 'Checkout failed. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      {/* Products Catalog Area */}
      <div className="flex-1 p-4 sm:p-6 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black text-[#8B1E2D] tracking-tight">
              BulSU POS Terminal
            </h1>
            <p className="text-xs text-gray-500 font-semibold mt-0.5">
              Cashier on Duty:{' '}
              <span className="text-[#8B1E2D] font-bold">
                {currentCashier.name}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShiftError('');
                setIsShiftModalOpen(true);
              }}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition shadow-sm cursor-pointer ${
                currentShift
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <Coins size={15} />
              <span>{shiftLoading ? 'Loading Shift' : currentShift ? 'Shift Open' : 'Open Shift'}</span>
            </button>

            {lastReceipt && (
              <button
                onClick={() => {
                  setActiveReceipt(lastReceipt);
                  setIsReceiptOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition shadow-sm cursor-pointer"
                title="View & print the most recent receipt (multiple copies)"
              >
                <FileText size={15} className="text-[#8B1E2D]" />
                <span>Last Receipt</span>
              </button>
            )}

            <button
              onClick={() => setIsRecentModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition shadow-sm cursor-pointer"
              title="View recent receipts & reprint"
            >
              <History size={15} className="text-[#8B1E2D]" />
              <span>Shift Receipts {recentSales.length > 0 ? `(${recentSales.length})` : ''}</span>
            </button>

            <button
              onClick={() => setIsLogoutModalOpen(true)}
              title={currentShift ? 'Your shift will remain open if you log out.' : 'Logout'}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-700 transition shadow cursor-pointer"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Product Search & Counter Bar */}
        <div className="mb-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by product name, SKU, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm font-medium focus:border-[#8B1E2D] focus:outline-none shadow-sm"
            />
          </div>

          <span className="text-xs font-bold text-gray-500 whitespace-nowrap bg-white px-3.5 py-2.5 rounded-2xl border border-gray-200 shadow-sm">
            {filteredStocks.length} Products Available
          </span>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredStocks.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-400">
              <p className="text-sm font-bold">
                {searchQuery
                  ? `No products found matching "${searchQuery}".`
                  : 'No inventory items available in stock.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredStocks.map((product) => {
                const isOutOfStock = (Number(product.quantity) || 0) <= 0;
                const inCartItem = cart.find((i) => i.id === product.id);

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && addToCart(product)}
                    className={`relative rounded-2xl p-4 shadow-sm border transition flex flex-col justify-between ${
                      isOutOfStock
                        ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                        : 'cursor-pointer bg-white hover:border-[#8B1E2D] hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-base text-gray-900 leading-snug">
                          {product.name}
                        </h3>
                        {inCartItem && (
                          <span className="rounded-full bg-[#8B1E2D] px-2 py-0.5 text-[11px] font-black text-white shrink-0">
                            {inCartItem.qty} in cart
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {product.sku ? `SKU: ${product.sku}` : 'No SKU'}
                        {product.category ? ` · ${product.category}` : ''}
                      </p>
                      <p className="text-[#8B1E2D] font-black text-xl mt-1.5">
                        ₱{Number(product.price).toFixed(2)}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                      {isOutOfStock ? (
                        <span className="rounded-lg bg-red-100 px-2 py-0.5 font-black text-red-700">
                          OUT OF STOCK
                        </span>
                      ) : (
                        <span
                          className={`font-semibold ${
                            product.quantity <= 5
                              ? 'text-amber-600 font-bold'
                              : 'text-gray-500'
                          }`}
                        >
                          Stock: {product.quantity}
                        </span>
                      )}

                      {!isOutOfStock && (
                        <span className="font-bold text-[#8B1E2D] flex items-center gap-0.5">
                          <Plus size={14} /> Add
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart & Checkout Panel */}
      <div className="w-96 bg-white shadow-2xl flex flex-col justify-between border-l border-gray-200 overflow-hidden shrink-0">
        {/* Cart Header */}
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[#8B1E2D] flex items-center gap-2">
              <ShoppingCart size={20} /> Current Order
            </h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
              >
                <Trash2 size={13} /> Clear
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {cart.reduce((a, b) => a + b.qty, 0)} total item(s) selected
          </p>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 text-gray-400">
              <ShoppingCart size={40} className="mb-2 text-gray-300" />
              <p className="text-sm font-bold text-gray-600">Your Cart is Empty</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                Click any product on the left catalog to add it to this order.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-sm"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-bold text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400 font-mono">
                    ₱{Number(item.price).toFixed(2)} each
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Quantity Controls */}
                  <div className="flex items-center rounded-lg border border-gray-200 bg-white">
                    <button
                      onClick={() => decreaseQty(item.id)}
                      className="px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="px-2 py-0.5 font-bold text-xs text-gray-800">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => increaseQty(item.id)}
                      disabled={item.qty >= item.quantity}
                      className="px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition disabled:opacity-30"
                      aria-label="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <p className="w-16 text-right font-black text-gray-900 font-mono text-xs">
                    ₱{(item.price * item.qty).toFixed(2)}
                  </p>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-gray-300 hover:text-red-600 transition p-1"
                    title="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout & Payment Area */}
        <div className="border-t border-gray-200 bg-white p-4 space-y-3 shadow-lg">
          {/* Error Message */}
          {checkoutError && (
            <div className="rounded-xl bg-red-50 p-2.5 text-xs font-bold text-red-700 border border-red-200">
              {checkoutError}
            </div>
          )}
          {!shiftLoading && !currentShift && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs font-bold text-amber-900">
              Open a shift and enter the starting cash float before checkout.
            </div>
          )}

          {/* Discount Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1">
              <Percent size={13} className="text-[#8B1E2D]" /> Special Discount
            </label>
            <select
              value={discountType}
              onChange={(e) => {
                setDiscountType(e.target.value);
                setDiscountId('');
                setCheckoutError('');
              }}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs font-bold text-gray-700 focus:outline-none focus:border-[#8B1E2D]"
            >
              <option value="none">Regular (No Discount)</option>
              <option value="senior">Senior Citizen (20% Off)</option>
              <option value="pwd">PWD (20% Off)</option>
              <option value="student">Student (10% Off)</option>
            </select>
            {discountType !== 'none' && (
              <div className="mt-2">
                <label htmlFor="discount-id" className="mb-1 block text-xs font-bold text-gray-600">
                  {DISCOUNT_LABELS[discountType]} ID Number
                </label>
                <input
                  id="discount-id"
                  type="text"
                  value={discountId}
                  onChange={(event) => {
                    setDiscountId(event.target.value);
                    setCheckoutError('');
                  }}
                  maxLength={60}
                  autoComplete="off"
                  placeholder={`Enter ${DISCOUNT_LABELS[discountType]} ID number`}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-sm font-semibold text-gray-900 focus:border-[#8B1E2D] focus:outline-none"
                  required
                />
              </div>
            )}
          </div>

          {/* Payment method and tender details */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-600" htmlFor="payment-method">
              Payment Method
            </label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(event) => {
                setPaymentMethod(event.target.value);
                setPaymentReference('');
                setCashTendered('');
                setCheckoutError('');
              }}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-xs font-bold text-gray-700 focus:border-[#8B1E2D] focus:outline-none"
            >
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="maya">Maya</option>
            </select>

            {paymentMethod === 'cash' ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-600 flex items-center gap-1" htmlFor="cash-received">
                    <Coins size={13} className="text-amber-600" /> Cash Received (₱)
                  </label>
                  {numericCash > 0 && (
                    <span className={`text-xs font-bold ${isCashInsufficient ? 'text-red-600' : 'text-emerald-700'}`}>
                      Change: ₱{change.toFixed(2)}
                    </span>
                  )}
                </div>
                <input
                  id="cash-received"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`Enter amount (e.g. ${total.toFixed(2)})`}
                  value={cashTendered}
                  onChange={(event) => {
                    setCashTendered(event.target.value);
                    setCheckoutError('');
                  }}
                  className={`w-full rounded-xl border p-2 text-sm font-black focus:outline-none font-mono ${
                    isCashInsufficient
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-gray-50 text-gray-900 focus:border-[#8B1E2D]'
                  }`}
                />
                {total > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <button type="button" onClick={() => handleQuickCash('exact')} className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-bold text-gray-700 hover:bg-gray-100 transition">
                      Exact (₱{total.toFixed(2)})
                    </button>
                    {[100, 200, 500, 1000].filter((bill) => bill >= total).slice(0, 3).map((bill) => (
                      <button key={bill} type="button" onClick={() => handleQuickCash(bill)} className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-bold text-gray-700 hover:bg-gray-100 transition">
                        ₱{bill}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="payment-reference" className="mb-1 block text-xs font-bold text-gray-600">
                  {paymentMethod === 'gcash' ? 'GCash' : 'Maya'} Reference Number
                </label>
                <input
                  id="payment-reference"
                  type="text"
                  maxLength={80}
                  placeholder="Enter payment reference number"
                  value={paymentReference}
                  onChange={(event) => {
                    setPaymentReference(event.target.value);
                    setCheckoutError('');
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-sm font-semibold text-gray-900 focus:border-[#8B1E2D] focus:outline-none"
                  required
                />
              </div>
            )}
          </div>

          {/* Subtotal, Discount, Total Calculations */}
          <div className="space-y-1 text-xs border-t pt-2 text-gray-600 font-mono">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-bold">₱{subtotal.toFixed(2)}</span>
            </div>
            {discountRate > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Discount ({discountRate * 100}%):</span>
                <span>-₱{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-base font-black text-gray-900 border-t pt-1.5 font-sans">
              <span>TOTAL DUE:</span>
              <span className="text-[#8B1E2D] font-mono text-xl">
                ₱{total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Checkout & Issue Receipt Button */}
          <button
            onClick={() => {
              if (!currentShift && !shiftLoading) {
                setCheckoutError('');
                setShiftError('Open a shift before accepting payment.');
                setIsShiftModalOpen(true);
                return;
              }
              handleCheckout();
            }}
            disabled={shiftLoading || isCheckingOut}
            className="w-full rounded-2xl bg-[#8B1E2D] hover:bg-[#6c1723] text-white py-3.5 text-sm font-black shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Receipt size={18} />
            <span>
              {isCheckingOut
                ? 'Processing…'
                : shiftLoading
                  ? 'Loading Shift…'
                  : currentShift
                    ? cart.length > 0 ? 'Pay & Issue Receipt' : 'Add Items to Issue Receipt'
                    : 'Open Shift to Pay'}
            </span>
          </button>
        </div>
      </div>

      {/* Recent Receipts Modal for Cashier Terminal */}
      {isRecentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b px-6 py-4 bg-gray-50">
              <div className="flex items-center gap-2 text-[#8B1E2D]">
                <History size={20} />
                <h3 className="font-black text-sm uppercase tracking-wider text-gray-800">
                  Recent Shift Receipts
                </h3>
              </div>
              <button
                onClick={() => setIsRecentModalOpen(false)}
                className="rounded-xl p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition cursor-pointer"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {recentSales.length === 0 ? (
                <div className="text-center py-10">
                  <Receipt size={36} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-bold text-gray-700">No Recent Receipts</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Completed orders from this shift will be listed here for quick reprint.
                  </p>
                </div>
              ) : (
                recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/80 rounded-2xl border border-gray-200 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[#8B1E2D] text-xs">
                          #{sale.id ? sale.id.slice(-8).toUpperCase() : 'N/A'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {sale.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {sale.items?.length || 0} item{sale.items?.length !== 1 ? 's' : ''} •{' '}
                        <strong className="text-gray-900 font-mono">
                          ₱{Number(sale.total || 0).toFixed(2)}
                        </strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveReceipt(sale);
                        setIsRecentModalOpen(false);
                        setIsReceiptOpen(true);
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-[#8B1E2D] hover:bg-[#6c1723] text-white px-3 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
                      title="Reprint this receipt (multiple copies)"
                    >
                      <Printer size={13} />
                      <span>Print Receipt</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t px-6 py-3.5 bg-gray-50 text-right">
              <button
                type="button"
                onClick={() => setIsRecentModalOpen(false)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cashier shift opening, X reading, and Z close workflow */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-gray-800">Cashier Shift</h3>
                <p className="mt-1 text-xs text-gray-500">{currentCashier.name || 'Cashier on duty'}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="rounded-xl p-1 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700"
                aria-label="Close shift panel"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[85vh] space-y-4 overflow-y-auto p-6">
              {shiftError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                  {shiftError}
                </div>
              )}

              {currentShift ? (
                <>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Shift is open</p>
                    <p className="mt-1 text-xs text-emerald-800">Started {new Date(currentShift.openedAt).toLocaleString()}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      ['Opening float', `₱${Number(currentShift.openingFloat || 0).toFixed(2)}`],
                      ['Expected cash', `₱${Number(shiftSummary?.expectedCash || 0).toFixed(2)}`],
                      ['Completed sales', shiftSummary?.salesCount || 0],
                      ['Cash sales', `₱${Number(shiftSummary?.cashSales || 0).toFixed(2)}`],
                      ['GCash sales', `₱${Number(shiftSummary?.gcashSales || 0).toFixed(2)}`],
                      ['Maya sales', `₱${Number(shiftSummary?.mayaSales || 0).toFixed(2)}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{value}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleXReading}
                    disabled={shiftBusy}
                    className="w-full rounded-xl border border-[#8B1E2D] bg-white px-4 py-2.5 text-xs font-black text-[#8B1E2D] transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {shiftBusy ? 'Saving…' : 'Create X Reading'}
                  </button>

                  <form onSubmit={handleCloseShift} className="space-y-3 border-t border-dashed border-gray-200 pt-4">
                    <div>
                      <label htmlFor="closing-cash-count" className="mb-1 block text-xs font-bold text-gray-600">
                        Cash counted in drawer (₱)
                      </label>
                      <input
                        id="closing-cash-count"
                        type="number"
                        min="0"
                        step="0.01"
                        value={closingCashCount}
                        onChange={(event) => setClosingCashCount(event.target.value)}
                        placeholder="Enter actual drawer cash"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-bold text-gray-900 focus:border-[#8B1E2D] focus:outline-none"
                        required
                      />
                      <p className="mt-1 text-[11px] text-gray-500">
                        Expected cash: ₱{Number(shiftSummary?.expectedCash || 0).toFixed(2)}. The difference is recorded in the Z reading.
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={shiftBusy || cart.length > 0}
                      className="w-full rounded-xl bg-[#8B1E2D] px-4 py-3 text-xs font-black text-white shadow-md transition hover:bg-[#6c1723] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {shiftBusy ? 'Closing shift…' : cart.length > 0 ? 'Clear the cart to close shift' : 'Close Shift & Create Z Reading'}
                    </button>
                  </form>
                </>
              ) : (
                <form onSubmit={handleOpenShift} className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                    Start a shift by entering the cash float placed in the drawer. Checkout stays unavailable until a shift is open.
                  </div>
                  <div>
                    <label htmlFor="opening-float" className="mb-1 block text-xs font-bold text-gray-600">
                      Opening cash float (₱)
                    </label>
                    <input
                      id="opening-float"
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingFloat}
                      onChange={(event) => setOpeningFloat(event.target.value)}
                      placeholder="Enter starting drawer cash"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-bold text-gray-900 focus:border-[#8B1E2D] focus:outline-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={shiftBusy || shiftLoading}
                    className="w-full rounded-xl bg-[#8B1E2D] px-4 py-3 text-xs font-black text-white shadow-md transition hover:bg-[#6c1723] disabled:opacity-50"
                  >
                    {shiftBusy ? 'Opening shift…' : 'Open Shift'}
                  </button>
                </form>
              )}

              {readingHistory.length > 0 && (
                <div className="border-t border-dashed border-gray-200 pt-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">Recent shift readings</p>
                  <div className="space-y-2">
                    {readingHistory.map((reading) => (
                      <button
                        key={`${reading.shiftId}-${reading.type}-${reading.createdAt}`}
                        type="button"
                        onClick={() => {
                          setIsShiftModalOpen(false);
                          setReadingToShow(reading);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-left transition hover:bg-gray-100"
                      >
                        <span className="text-xs font-black text-[#8B1E2D]">{reading.type} Reading</span>
                        <span className="text-right text-[10px] text-gray-500">{new Date(reading.createdAt).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Official Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={activeReceipt}
      />

      <ShiftReportModal
        reading={readingToShow}
        onClose={() => setReadingToShow(null)}
      />

      {/* Confirm Logout Modal */}
      <ConfirmLogoutModal
        isOpen={isLogoutModalOpen}
        message={currentShift
          ? 'Your shift will remain open. Sign back in as the same cashier to continue or close it.'
          : undefined}
        onConfirm={handleConfirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </div>
  );
};

export default CashierPOS;
