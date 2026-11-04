// src/pages/AdminDashboard.jsx
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { rtdb } from "../firebase/firebaseConfig";
import { ref, onValue } from "firebase/database";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  Activity,
  FileText,
  AlertOctagon,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { getSaleCogs, getSaleGrossProfit, roundMoney } from "../utils/financials";

export default function AdminDashboard() {
  const [sales, setSales] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);

  // Real-time Firebase RTDB listeners
  useEffect(() => {
    const salesRef = ref(rtdb, "sales");
    const stocksRef = ref(rtdb, "stocks");
    const cashiersRef = ref(rtdb, "cashiers");

    const unsubSales = onValue(
      salesRef,
      (snapshot) => {
        const data = snapshot.val();
        const list = [];
        if (data) {
          for (let id in data) {
            list.push({ id, ...data[id] });
          }
        }
        setSales(list);
        setLastSync(new Date());
        setLoading(false);
      },
      (err) => {
        console.error("Failed to subscribe to sales:", err);
        setLoading(false);
      }
    );

    const unsubStocks = onValue(
      stocksRef,
      (snapshot) => {
        const data = snapshot.val();
        const list = [];
        if (data) {
          for (let id in data) {
            if (id === '__posOperations') continue;
            list.push({ id, ...data[id] });
          }
        }
        setStocks(list);
        setLastSync(new Date());
      },
      (err) => {
        console.error("Failed to subscribe to stocks:", err);
      }
    );

    const unsubCashiers = onValue(
      cashiersRef,
      (snapshot) => {
        const data = snapshot.val();
        const list = [];
        if (data) {
          for (let id in data) {
            list.push({ id, ...data[id] });
          }
        }
        setCashiers(list);
        setLastSync(new Date());
      },
      (err) => {
        console.error("Failed to subscribe to cashiers:", err);
      }
    );

    return () => {
      unsubSales();
      unsubStocks();
      unsubCashiers();
    };
  }, []);

  // Format currency in Philippine Peso
  const formatPeso = (val) => {
    const num = Number(val) || 0;
    return `₱${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Check if a sale date is today
  const isToday = (timestampStr) => {
    if (!timestampStr) return false;
    const dateObj = new Date(timestampStr);
    if (!isNaN(dateObj.getTime())) {
      const today = new Date();
      return (
        dateObj.getDate() === today.getDate() &&
        dateObj.getMonth() === today.getMonth() &&
        dateObj.getFullYear() === today.getFullYear()
      );
    }
    return timestampStr.includes(new Date().toLocaleDateString());
  };

  // Filtered sales
  const validSales = useMemo(
    () => sales.filter((s) => !s.voided),
    [sales]
  );
  const voidedSales = useMemo(
    () => sales.filter((s) => !!s.voided),
    [sales]
  );

  const todaySales = useMemo(
    () => validSales.filter((s) => isToday(s.timestamp)),
    [validSales]
  );

  // Revenue metrics
  const totalRevenue = useMemo(
    () =>
      validSales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0),
    [validSales]
  );

  const todayRevenue = useMemo(
    () =>
      todaySales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0),
    [todaySales]
  );

  // Items sold metrics
  const totalItemsSold = useMemo(() => {
    return validSales.reduce((acc, sale) => {
      const itemsCount = Array.isArray(sale.items)
        ? sale.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
        : 0;
      return acc + itemsCount;
    }, 0);
  }, [validSales]);

  const todayItemsSold = useMemo(() => {
    return todaySales.reduce((acc, sale) => {
      const itemsCount = Array.isArray(sale.items)
        ? sale.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
        : 0;
      return acc + itemsCount;
    }, 0);
  }, [todaySales]);

  // Inventory & Stock metrics
  const totalProducts = stocks.length;
  const totalStockUnits = useMemo(
    () =>
      stocks.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0),
    [stocks]
  );

  const inventoryValue = useMemo(() => {
    return stocks.reduce((acc, item) => {
      const q = Number(item.quantity) || 0;
      const cost = Number(item.costPrice);
      return Number.isFinite(cost) && cost >= 0 ? acc + q * cost : acc;
    }, 0);
  }, [stocks]);

  const uncostedStockCount = useMemo(
    () => stocks.filter((item) =>
      item.costPrice === null ||
      item.costPrice === undefined ||
      item.costPrice === '' ||
      !Number.isFinite(Number(item.costPrice)) ||
      Number(item.costPrice) < 0
    ).length,
    [stocks]
  );

  const costedSales = useMemo(
    () => validSales.filter((sale) => getSaleCogs(sale) !== null),
    [validSales]
  );

  const totalCogs = useMemo(
    () => roundMoney(costedSales.reduce((sum, sale) => sum + getSaleCogs(sale), 0)),
    [costedSales]
  );

  const grossProfit = useMemo(
    () => roundMoney(costedSales.reduce((sum, sale) => sum + (getSaleGrossProfit(sale) || 0), 0)),
    [costedSales]
  );

  const costedSalesRevenue = useMemo(
    () => roundMoney(costedSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0)),
    [costedSales]
  );

  const grossMarginPercentage = costedSalesRevenue > 0
    ? (grossProfit / costedSalesRevenue) * 100
    : 0;
  const uncostedSalesCount = validSales.length - costedSales.length;

  const outOfStockItems = useMemo(
    () => stocks.filter((item) => (Number(item.quantity) || 0) <= 0),
    [stocks]
  );

  const lowStockItems = useMemo(
    () =>
      stocks.filter((item) => {
        const q = Number(item.quantity) || 0;
        return q > 0 && q <= 5;
      }),
    [stocks]
  );

  // Cashiers metrics
  const activeCashiers = useMemo(
    () => cashiers.filter((c) => c.active !== false),
    [cashiers]
  );

  // Top selling products aggregated live
  const topProducts = useMemo(() => {
    const productMap = {};
    validSales.forEach((sale) => {
      if (Array.isArray(sale.items)) {
        sale.items.forEach((item) => {
          const name = item.name || "Unknown Product";
          const qty = Number(item.qty) || 0;
          const revenue = (Number(item.price) || 0) * qty;
          if (!productMap[name]) {
            productMap[name] = { name, qtySold: 0, revenue: 0 };
          }
          productMap[name].qtySold += qty;
          productMap[name].revenue += revenue;
        });
      }
    });

    return Object.values(productMap)
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 5);
  }, [validSales]);

  // Max units for relative progress bar
  const maxUnitsSold = useMemo(() => {
    if (topProducts.length === 0) return 1;
    return Math.max(...topProducts.map((p) => p.qtySold), 1);
  }, [topProducts]);

  // Recent transactions stream (latest first)
  const recentTransactions = useMemo(() => {
    return [...sales].reverse().slice(0, 6);
  }, [sales]);

  // Voided statistics
  const totalVoidedAmount = useMemo(
    () =>
      voidedSales.reduce((acc, sale) => acc + (Number(sale.total) || 0), 0),
    [voidedSales]
  );

  const avgOrderValue =
    validSales.length > 0 ? totalRevenue / validSales.length : 0;

  return (
    <main className="min-h-screen min-w-0 bg-gray-50 p-4 sm:p-6 lg:p-10">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
            Admin Overview
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Real-time monitoring of sales, inventory stocks, and cashier activities.
          </p>
        </div>

        {/* Administrator Role Badge */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 rounded-2xl border border-gray-100 bg-white px-4 py-2 text-xs font-bold text-gray-600 shadow-sm">
            <ShieldCheck size={14} className="text-[#8B1E2D]" />
            Role: <span className="text-[#8B1E2D]">Administrator</span>
          </div>
        </div>
      </header>

      {/* Real-time Low/Out of Stock Urgent Banner */}
      {(outOfStockItems.length > 0 || lowStockItems.length > 0) && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-900">
                  Inventory Stock Alert Notice
                </h3>
                <p className="mt-0.5 text-xs font-medium text-amber-800">
                  {outOfStockItems.length > 0 && (
                    <span className="font-bold text-red-700">
                      {outOfStockItems.length} item(s) out of stock
                    </span>
                  )}
                  {outOfStockItems.length > 0 && lowStockItems.length > 0 && " • "}
                  {lowStockItems.length > 0 && (
                    <span>
                      {lowStockItems.length} item(s) running low (5 or fewer units)
                    </span>
                  )}
                  . Please restock to avoid checkout disruptions.
                </p>

                {/* Stock Chips */}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {outOfStockItems.slice(0, 4).map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 border border-red-200"
                    >
                      {item.name}: OUT OF STOCK
                    </span>
                  ))}
                  {lowStockItems.slice(0, 4).map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-200/80 px-2 py-0.5 text-xs font-bold text-amber-900"
                    >
                      {item.name}: {item.quantity} left
                    </span>
                  ))}
                  {outOfStockItems.length + lowStockItems.length > 8 && (
                    <span className="text-xs font-bold text-amber-800 self-center">
                      +{outOfStockItems.length + lowStockItems.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Link
              to="/admin/stocks"
              className="flex shrink-0 items-center gap-1.5 self-start sm:self-center rounded-xl bg-[#8B1E2D] px-4 py-2 text-xs font-black text-white shadow transition hover:bg-[#6c1723]"
            >
              <span>Restock Now</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* Top Realtime KPI Grid */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
        {/* KPI 1: Total Revenue */}
        <article className="min-w-0 rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm sm:p-6 transition hover:shadow-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Total Revenue
            </span>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <DollarSign size={20} />
            </div>
          </div>
          <h2 className="break-words text-2xl sm:text-3xl font-black text-gray-900">
            {loading ? (
              <span className="text-gray-300">Loading...</span>
            ) : (
              formatPeso(totalRevenue)
            )}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="flex items-center gap-1 font-bold text-emerald-600">
              <TrendingUp size={14} /> {formatPeso(todayRevenue)}
            </span>
            <span className="text-gray-400 font-medium">today</span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500 font-semibold">
              {validSales.length} orders
            </span>
          </div>
        </article>

        {/* KPI 2: Total Items Sold */}
        <article className="min-w-0 rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm sm:p-6 transition hover:shadow-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Items Sold
            </span>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#8B1E2D]/10 text-[#8B1E2D]">
              <ShoppingCart size={20} />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            {loading ? (
              <span className="text-gray-300">Loading...</span>
            ) : (
              `${totalItemsSold} Items`
            )}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <span className="font-bold text-[#8B1E2D]">
              +{todayItemsSold} today
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-400 font-medium">
              Avg {formatPeso(avgOrderValue)}/tx
            </span>
          </div>
        </article>

        {/* KPI 3: Inventory Units */}
        <article className="min-w-0 rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm sm:p-6 transition hover:shadow-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Inventory Catalog
            </span>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Package size={20} />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            {loading ? (
              <span className="text-gray-300">Loading...</span>
            ) : (
              `${totalProducts} Products`
            )}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-bold text-gray-700">
              {totalStockUnits} units in stock
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-400 font-medium">
              Cost value: {formatPeso(inventoryValue)}
            </span>
          </div>
        </article>

        {/* KPI 4: Active Cashiers */}
        <article className="min-w-0 rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm sm:p-6 transition hover:shadow-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Active Cashiers
            </span>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Users size={20} />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
            {loading ? (
              <span className="text-gray-300">Loading...</span>
            ) : (
              `${activeCashiers.length} Active`
            )}
          </h2>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span className="font-bold text-amber-700">
              {cashiers.length} registered
            </span>
            <span className="text-gray-300">•</span>
            <Link
              to="/admin/cashiers"
              className="font-bold text-[#8B1E2D] hover:underline"
            >
              Manage accounts
            </Link>
          </div>
        </article>
      </section>

      {/* Main Grid: Live Transactions + Analytics / Top Products */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols wide on desktop): Live Transactions Feed */}
        <section className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm sm:p-7 lg:col-span-2">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-[#8B1E2D]" />
                <h2 className="text-lg font-black text-gray-900">
                  Live Transactions Stream
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-gray-400">
                Instantly reflects receipts completed or voided at cashier terminals.
              </p>
            </div>

            <Link
              to="/admin/sales"
              className="flex items-center gap-1 text-xs font-bold text-[#8B1E2D] hover:underline"
            >
              <span>View All ({sales.length})</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {/* Transactions List */}
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-[#8B1E2D] border-t-transparent" />
              Connecting to database...
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
              <ShoppingCart
                size={36}
                className="mx-auto text-gray-300 mb-2"
              />
              <p className="text-sm font-bold text-gray-700">
                No Transactions Recorded Yet
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Completed purchases punched in cashier terminals will
                stream here in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((tx) => {
                const isVoid = !!tx.voided;
                const itemsCount = Array.isArray(tx.items)
                  ? tx.items.reduce((s, i) => s + (Number(i.qty) || 0), 0)
                  : 0;

                return (
                  <div
                    key={tx.id}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border transition ${
                      isVoid
                        ? "bg-red-50/50 border-red-200"
                        : "bg-gray-50/70 border-gray-100 hover:bg-gray-50 hover:border-gray-200"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-700">
                          #{tx.id.slice(-6).toUpperCase()}
                        </span>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            isVoid
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isVoid ? "Voided" : "Completed"}
                        </span>

                        <span className="text-xs text-gray-400">
                          {tx.timestamp}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                        <span className="font-bold text-gray-800">
                          Cashier: {tx.cashierName || "Cashier"}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span>
                          {itemsCount} item{itemsCount !== 1 ? "s" : ""}
                        </span>
                        {Array.isArray(tx.items) && tx.items.length > 0 && (
                          <span className="text-gray-400 truncate max-w-xs">
                            ({tx.items.map((i) => `${i.name} x${i.qty}`).join(", ")})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <p
                        className={`text-lg font-black ${
                          isVoid ? "text-red-700 line-through" : "text-gray-900"
                        }`}
                      >
                        {formatPeso(tx.total)}
                      </p>
                      {tx.discountPercentage > 0 && (
                        <p className="text-[11px] font-bold text-amber-700">
                          Discount: {tx.discountPercentage}%
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Top Products & Quick Financial Breakdown */}
        <section className="space-y-6">
          {/* Top Selling Fast-Moving Products Card */}
          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-[#8B1E2D]" />
                <h3 className="text-base font-black text-gray-900">
                  Fast-Moving Products
                </h3>
              </div>
              <span className="text-xs font-bold text-gray-400">By Sales</span>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-6 text-center">
                <Package size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs font-bold text-gray-600">
                  No Product Sales Yet
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Top performing items will automatically calculate here based
                  on checkouts.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {topProducts.map((p, idx) => {
                  const pct = Math.round((p.qtySold / maxUnitsSold) * 100);
                  return (
                    <div key={p.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-800 flex items-center gap-1.5">
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-[10px] font-black text-gray-600">
                            {idx + 1}
                          </span>
                          <span className="truncate max-w-[140px] sm:max-w-[180px]">
                            {p.name}
                          </span>
                        </span>
                        <div className="text-right">
                          <span className="font-black text-gray-900">
                            {p.qtySold} sold
                          </span>
                          <span className="text-gray-400 text-[11px] ml-1.5">
                            ({formatPeso(p.revenue)})
                          </span>
                        </div>
                      </div>

                      {/* Visual progress bar */}
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#8B1E2D]"
                          style={{ width: `${Math.max(pct, 8)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Financial Summary */}
          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="mb-3 text-base font-black text-gray-900 flex items-center gap-2">
              <Layers size={18} className="text-[#8B1E2D]" />
              System Financial Summary
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-2.5">
                <span className="font-semibold text-gray-500">Gross Sales</span>
                <span className="font-black text-gray-900">
                  {formatPeso(totalRevenue)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-2.5">
                <span className="font-semibold text-gray-500">COGS (costed sales)</span>
                <span className="font-black text-gray-900">{formatPeso(totalCogs)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-2.5">
                <span className="font-semibold text-emerald-700">Actual Gross Profit</span>
                <span className="font-black text-emerald-800">{formatPeso(grossProfit)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-2.5">
                <span className="font-semibold text-emerald-700">Gross Margin</span>
                <span className="font-black text-emerald-800">{grossMarginPercentage.toFixed(2)}%</span>
              </div>

              {(uncostedSalesCount > 0 || uncostedStockCount > 0) && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                  Profit uses {costedSales.length} fully costed sale(s); {uncostedSalesCount} sale(s) need cost data and {uncostedStockCount} inventory item(s) have no cost price.
                </p>
              )}

              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-2.5">
                <span className="font-semibold text-gray-500">
                  Average Order Value (AOV)
                </span>
                <span className="font-black text-gray-900">
                  {formatPeso(avgOrderValue)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-red-50/70 p-2.5">
                <span className="font-semibold text-red-700 flex items-center gap-1">
                  <AlertOctagon size={13} /> Voided Sales ({voidedSales.length})
                </span>
                <span className="font-black text-red-700">
                  {formatPeso(totalVoidedAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-blue-50/70 p-2.5">
                <span className="font-semibold text-blue-700 flex items-center gap-1">
                  <Package size={13} /> Inventory Cost Value
                </span>
                <span className="font-black text-blue-700">
                  {formatPeso(inventoryValue)}
                </span>
              </div>
            </div>

            {lastSync && (
              <p className="mt-4 text-center text-[10px] text-gray-400">
                Database synced at {lastSync.toLocaleTimeString()}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Quick Action Navigation Grid */}
      <section className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm sm:rounded-[32px] sm:p-7">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900">
              Quick Actions &amp; Navigation
            </h2>
            <p className="text-xs text-gray-500">
              Direct access to BulSU inventory, cashier accounts, and sales reports.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/admin/stocks"
            className="flex items-center gap-3.5 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition hover:border-[#8B1E2D] hover:bg-white hover:shadow-md group"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shadow-sm transition group-hover:scale-105">
              <Package size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900 group-hover:text-[#8B1E2D]">
                Stock Inventory
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                Add, restock, or edit items
              </p>
            </div>
          </Link>

          <Link
            to="/admin/cashiers"
            className="flex items-center gap-3.5 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition hover:border-[#8B1E2D] hover:bg-white hover:shadow-md group"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shadow-sm transition group-hover:scale-105">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900 group-hover:text-[#8B1E2D]">
                Cashier Accounts
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                Manage PINs &amp; cashier status
              </p>
            </div>
          </Link>

          <Link
            to="/admin/sales"
            className="flex items-center gap-3.5 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition hover:border-[#8B1E2D] hover:bg-white hover:shadow-md group"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shadow-sm transition group-hover:scale-105">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900 group-hover:text-[#8B1E2D]">
                Sales &amp; Reports
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                View receipts &amp; audit sales
              </p>
            </div>
          </Link>

          <Link
            to="/admin/voids"
            className="flex items-center gap-3.5 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition hover:border-[#8B1E2D] hover:bg-white hover:shadow-md group"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 shadow-sm transition group-hover:scale-105">
              <AlertOctagon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900 group-hover:text-[#8B1E2D]">
                Void Receipts Log
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                Review voided receipts &amp; audits
              </p>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
