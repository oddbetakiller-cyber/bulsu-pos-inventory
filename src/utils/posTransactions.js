import { get, push, ref, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase/firebaseConfig';

const INVENTORY_OPERATIONS_KEY = '__posOperations';

const transactAt = async (nodeRef, mutate) => {
  // Load this specific database node so the transaction uses the same scope as its rules.
  const initialSnapshot = await get(nodeRef);
  const initialValue = initialSnapshot.val();
  let isFirstAttempt = true;

  let abortReason = '';
  let resultValue;
  const transaction = await runTransaction(
    nodeRef,
    (currentValue) => {
      abortReason = '';
      resultValue = undefined;
      // A transaction may first run against an empty local cache. Use the value
      // just read from the server for that first attempt, then trust subsequent
      // server retries so concurrent changes are still handled safely.
      const value = isFirstAttempt && currentValue === null && initialSnapshot.exists()
        ? initialValue
        : currentValue;
      isFirstAttempt = false;
      const result = mutate(value);
      if (result.error) {
        abortReason = result.error;
        return;
      }
      resultValue = result.value;
      return result.data;
    },
    { applyLocally: false }
  );

  if (!transaction.committed) {
    throw new Error(abortReason || 'The database update was not committed. Please try again.');
  }
  return resultValue;
};

const sum = (sales, predicate) =>
  sales.reduce((total, sale) => total + (predicate(sale) ? Number(sale.total) || 0 : 0), 0);

export const summarizeShift = (shift, salesData = {}) => {
  const sales = Object.values(salesData || {}).filter((sale) => sale?.shiftId === shift.id);
  const activeSales = sales.filter((sale) => !sale.voided);
  const voidedSales = sales.filter((sale) => sale.voided);
  const isCash = (sale) => (sale.paymentMethod || 'cash') === 'cash';
  const cashSales = sum(activeSales, isCash);
  const gcashSales = sum(activeSales, (sale) => sale.paymentMethod === 'gcash');
  const mayaSales = sum(activeSales, (sale) => sale.paymentMethod === 'maya');

  return {
    salesCount: activeSales.length,
    voidedCount: voidedSales.length,
    voidedTotal: sum(voidedSales, () => true),
    totalSales: sum(activeSales, () => true),
    cashSales,
    gcashSales,
    mayaSales,
    expectedCash: (Number(shift.openingFloat) || 0) + cashSales,
  };
};

const getRestockQuantities = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('This receipt has no item details to restock.');
  }

  const quantities = {};
  for (const item of items) {
    const quantity = Number(item.qty);
    if (!item.id || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('This receipt has incomplete item details and cannot be safely restocked.');
    }
    quantities[item.id] = (quantities[item.id] || 0) + quantity;
  }
  return quantities;
};

const applyInventoryRestock = async (saleId, items, restockedBy) => {
  const quantities = getRestockQuantities(items);
  const stocksRef = ref(rtdb, 'stocks');
  const appliedAt = Date.now();

  return transactAt(stocksRef, (currentStocks) => {
    if (!currentStocks) return { error: 'Inventory could not be loaded.' };

    const operations = currentStocks[INVENTORY_OPERATIONS_KEY] || {};
    if (operations.restockedSales?.[saleId]) {
      return { data: currentStocks, value: false };
    }

    const updatedStocks = { ...currentStocks };
    for (const [stockId, quantity] of Object.entries(quantities)) {
      const stock = updatedStocks[stockId];
      if (!stock) {
        const itemName = items.find((item) => item.id === stockId)?.name || 'A receipt item';
        return { error: `${itemName} is missing from inventory. Restore the product before restocking this receipt.` };
      }
      const currentQuantity = Number(stock.quantity);
      if (!Number.isFinite(currentQuantity) || currentQuantity < 0) {
        return { error: 'Inventory has an invalid quantity. Correct the stock record before restocking.' };
      }
      updatedStocks[stockId] = { ...stock, quantity: currentQuantity + quantity };
    }

    updatedStocks[INVENTORY_OPERATIONS_KEY] = {
      ...operations,
      restockedSales: {
        ...(operations.restockedSales || {}),
        [saleId]: { appliedAt, appliedBy: restockedBy || 'Administrator' },
      },
    };

    return { data: updatedStocks, value: true };
  });
};

const markLegacyRestockComplete = async (saleId, restockedBy) => {
  const saleRef = ref(rtdb, `sales/${saleId}`);
  const timestamp = Date.now();
  return transactAt(saleRef, (sale) => {
    if (!sale) return { error: 'Receipt not found.' };
    if (!sale.voided) return { error: 'Only voided receipts can be restocked from this screen.' };
    if (sale.inventoryRestocked) return { error: 'Inventory has already been restocked for this receipt.' };

    const updatedSale = {
      ...sale,
      inventoryRestocked: true,
      inventoryRestockedAt: timestamp,
      inventoryRestockedBy: restockedBy || 'Administrator',
    };
    return { data: updatedSale, value: updatedSale };
  });
};

export const openCashierShift = async ({ cashierKey, cashierId, cashierName, openingFloat }) => {
  const shiftsRef = ref(rtdb, 'shifts');
  const shiftId = push(shiftsRef).key;
  const shift = {
    id: shiftId,
    cashierKey,
    cashierId: cashierId || null,
    cashierName,
    openingFloat,
    openedAt: Date.now(),
    status: 'open',
    pendingCheckouts: 0,
  };

  return transactAt(shiftsRef, (currentShifts) => {
    const shifts = currentShifts || {};
    const existingShift = Object.values(shifts).find(
      (candidate) => candidate?.cashierKey === cashierKey && ['open', 'closing'].includes(candidate.status)
    );
    if (existingShift) return { error: 'You already have an open shift.' };
    return {
      data: { ...shifts, [shiftId]: shift },
      value: shift,
    };
  });
};

export const checkoutWithStock = async ({
  cashierKey,
  shiftId,
  shiftSnapshot,
  saleId,
  receipt,
  items,
}) => {
  const shiftRef = ref(rtdb, `shifts/${shiftId}`);
  const stocksRef = ref(rtdb, 'stocks');
  const saleRef = ref(rtdb, `sales/${saleId}`);
  const requested = {};
  for (const item of items) {
    requested[item.id] = {
      qty: (requested[item.id]?.qty || 0) + Number(item.qty),
      name: item.name,
    };
  }

  let shiftClaimed = false;
  let inventoryDeducted = false;
  let saleSaved = false;
  let savedReceipt = { ...receipt, shiftId };

  try {
    const existingReceipt = await get(saleRef);
    if (existingReceipt.exists()) throw new Error('This receipt already exists. Please try checkout again.');

    await transactAt(shiftRef, (storedShift) => {
      const shift = storedShift || (
        shiftSnapshot?.id === shiftId && shiftSnapshot.status === 'open'
          ? shiftSnapshot
          : null
      );
      if (!shift || shift.status !== 'open') {
        return { error: 'No open shift record was found. Reopen the shift, then try checkout again.' };
      }
      if (shift.cashierKey !== cashierKey) {
        return { error: 'The open shift belongs to a different cashier. Sign in as the cashier who opened it.' };
      }

      return {
        data: {
          ...shift,
          pendingCheckouts: (Number(shift.pendingCheckouts) || 0) + 1,
        },
        value: true,
      };
    });
    shiftClaimed = true;

    await transactAt(stocksRef, (currentStocks) => {
      if (!currentStocks) return { error: 'No inventory records were found.' };
      const updatedStocks = { ...currentStocks };

      for (const [stockId, item] of Object.entries(requested)) {
        const stock = updatedStocks[stockId];
        const available = Number(stock?.quantity);
        if (!stock || !Number.isFinite(available) || available < item.qty) {
          return { error: `${item.name} does not have enough stock available. Refresh the product list and try again.` };
        }
        updatedStocks[stockId] = { ...stock, quantity: available - item.qty };
      }

      return { data: updatedStocks, value: true };
    });
    inventoryDeducted = true;

    await transactAt(saleRef, (existingSale) => {
      if (existingSale) return { error: 'This receipt already exists. Please try checkout again.' };
      return { data: savedReceipt, value: savedReceipt };
    });
    saleSaved = true;
    return savedReceipt;
  } catch (error) {
    if (inventoryDeducted && !saleSaved) {
      try {
        const persistedSale = await get(saleRef);
        if (persistedSale.exists()) {
          saleSaved = true;
          savedReceipt = persistedSale.val();
        } else {
          await transactAt(stocksRef, (currentStocks) => {
            if (!currentStocks) return { error: 'Inventory is unavailable for checkout rollback.' };
            const updatedStocks = { ...currentStocks };
            for (const [stockId, item] of Object.entries(requested)) {
              const stock = updatedStocks[stockId];
              if (!stock) return { error: `${item.name} disappeared before checkout could be rolled back.` };
              updatedStocks[stockId] = {
                ...stock,
                quantity: (Number(stock.quantity) || 0) + item.qty,
              };
            }
            return { data: updatedStocks, value: true };
          });
        }
      } catch (rollbackError) {
        throw new Error(`${error.message} Inventory rollback failed: ${rollbackError.message}`);
      }
    }
    if (saleSaved) return savedReceipt;
    throw error;
  } finally {
    if (shiftClaimed) {
      try {
        await transactAt(shiftRef, (shift) => {
          if (!shift) return { error: 'The shift disappeared after checkout.' };
          return {
            data: {
              ...shift,
              pendingCheckouts: Math.max(0, (Number(shift.pendingCheckouts) || 0) - 1),
            },
            value: true,
          };
        });
      } catch (error) {
        console.error('Failed to release the shift checkout lock:', error);
      }
    }
  }
};

export const voidSaleAndRestock = async (saleId, voidedBy) => {
  const saleRef = ref(rtdb, `sales/${saleId}`);
  const saleSnapshot = await get(saleRef);
  const initialSale = saleSnapshot.val();
  if (!initialSale) throw new Error('Receipt not found.');
  if (initialSale.voided) throw new Error('This receipt has already been voided.');

  const stockOperationsRef = ref(rtdb, `stocks/${INVENTORY_OPERATIONS_KEY}/restockedSales/${saleId}`);
  const existingRestock = await get(stockOperationsRef);
  let saleToVoid = initialSale;

  if (!initialSale.voiding) {
    saleToVoid = await transactAt(saleRef, (sale) => {
      if (!sale) return { error: 'Receipt not found.' };
      if (sale.voided) return { error: 'This receipt has already been voided.' };
      // Another tab or an interrupted attempt may already have claimed it.
      // Restocking is idempotent because the stock transaction records a marker.
      if (sale.voiding) return { data: sale, value: sale };
      const claimedSale = { ...sale, voiding: true };
      return { data: claimedSale, value: claimedSale };
    });
  }

  try {
    if (!existingRestock.exists()) {
      await applyInventoryRestock(saleId, saleToVoid.items, voidedBy);
    }
    const voidedAt = Date.now();
    return await transactAt(saleRef, (sale) => {
      if (!sale) return { error: 'Receipt not found.' };
      if (sale.voided) return { error: 'This receipt has already been voided.' };
      const updatedSale = {
        ...sale,
        voided: true,
        voiding: false,
        voidedAt,
        voidedBy: voidedBy || 'Administrator',
        inventoryRestocked: true,
        inventoryRestockedAt: voidedAt,
        inventoryRestockedBy: voidedBy || 'Administrator',
      };
      return { data: updatedSale, value: updatedSale };
    });
  } catch (error) {
    // A parallel void may have completed successfully while this caller was
    // finishing. Treat that as success rather than showing a false failure.
    try {
      const latestSale = (await get(saleRef)).val();
      if (latestSale?.voided && latestSale.inventoryRestocked) return latestSale;
    } catch {
      // Preserve the original failure and continue recovery below.
    }

    try {
      const restockState = await get(stockOperationsRef);
      if (!restockState.exists()) {
        await transactAt(saleRef, (sale) => {
          if (!sale || sale.voided) return { error: 'The receipt status changed while voiding.' };
          const restoredSale = { ...sale, voiding: false };
          return { data: restoredSale, value: restoredSale };
        });
      }
    } catch (resetError) {
      console.error('Failed to reset an interrupted void operation:', resetError);
    }
    throw error;
  }
};

export const restockVoidedSale = async (saleId, restockedBy) => {
  const saleRef = ref(rtdb, `sales/${saleId}`);
  const snapshot = await get(saleRef);
  const sale = snapshot.val();
  if (!sale) throw new Error('Receipt not found.');
  if (!sale.voided) throw new Error('Only voided receipts can be restocked from this screen.');
  if (sale.inventoryRestocked) throw new Error('Inventory has already been restocked for this receipt.');

  await applyInventoryRestock(saleId, sale.items, restockedBy);
  return markLegacyRestockComplete(saleId, restockedBy);
};

const makeReading = (shift, sales, type, countedCash, createdAt) => {
  const summary = summarizeShift(shift, sales);
  return {
    type,
    shiftId: shift.id,
    createdAt,
    cashierName: shift.cashierName,
    openedAt: shift.openedAt,
    openingFloat: Number(shift.openingFloat) || 0,
    ...summary,
    ...(type === 'Z'
      ? { countedCash, cashDifference: countedCash - summary.expectedCash }
      : {}),
  };
};

export const createXReading = async (shiftId, cashierKey) => {
  const shiftRef = ref(rtdb, `shifts/${shiftId}`);
  const salesSnapshot = await get(ref(rtdb, 'sales'));
  const sales = salesSnapshot.val() || {};
  const readingId = push(ref(rtdb, `shifts/${shiftId}/readings`)).key;
  const createdAt = Date.now();

  return transactAt(shiftRef, (shift) => {
    if (!shift || shift.status !== 'open' || shift.cashierKey !== cashierKey) {
      return { error: 'The shift is closed or unavailable.' };
    }
    if (Number(shift.pendingCheckouts) > 0) {
      return { error: 'A checkout is still processing. Try the X reading again in a moment.' };
    }
    const reading = makeReading(shift, sales, 'X', undefined, createdAt);
    return {
      data: { ...shift, readings: { ...(shift.readings || {}), [readingId]: reading } },
      value: reading,
    };
  });
};

export const closeCashierShift = async ({ shiftId, cashierKey, countedCash }) => {
  const shiftRef = ref(rtdb, `shifts/${shiftId}`);
  const closingShift = await transactAt(shiftRef, (shift) => {
    if (!shift || shift.status !== 'open' || shift.cashierKey !== cashierKey) {
      return { error: 'The shift is already closed or unavailable.' };
    }
    if (Number(shift.pendingCheckouts) > 0) {
      return { error: 'A checkout is still processing. Try closing the shift again in a moment.' };
    }
    return { data: { ...shift, status: 'closing' }, value: shift };
  });

  try {
    const salesSnapshot = await get(ref(rtdb, 'sales'));
    const sales = salesSnapshot.val() || {};
    const readingId = push(ref(rtdb, `shifts/${shiftId}/readings`)).key;
    const closedAt = Date.now();
    const reading = makeReading(closingShift, sales, 'Z', countedCash, closedAt);

    return await transactAt(shiftRef, (shift) => {
      if (!shift || shift.status !== 'closing' || shift.cashierKey !== cashierKey) {
        return { error: 'Shift closing was interrupted. Reopen the shift panel and try again.' };
      }
      const closedShift = {
        ...shift,
        status: 'closed',
        closedAt,
        closingCashCount: countedCash,
        expectedCash: reading.expectedCash,
        cashDifference: reading.cashDifference,
        zReading: reading,
        readings: { ...(shift.readings || {}), [readingId]: reading },
      };
      return { data: closedShift, value: reading };
    });
  } catch (error) {
    try {
      await transactAt(shiftRef, (shift) => {
        if (!shift || shift.status !== 'closing') return { error: 'Shift is no longer closing.' };
        return { data: { ...shift, status: 'open' }, value: true };
      });
    } catch (reopenError) {
      console.error('Failed to restore the shift after a close error:', reopenError);
    }
    throw error;
  }
};
