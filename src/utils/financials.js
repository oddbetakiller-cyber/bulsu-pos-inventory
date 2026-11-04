export const roundMoney = (value) => Number((Number(value) || 0).toFixed(2));

const isValidCost = (value) =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0;

export const getSaleCogs = (sale) => {
  if (sale?.cogsComplete === false) return null;

  if (sale?.cogsComplete === true && isValidCost(sale.cogs)) {
    return roundMoney(sale.cogs);
  }

  if (!Array.isArray(sale?.items) || sale.items.length === 0) return null;

  let totalCogs = 0;
  for (const item of sale.items) {
    const quantity = Number(item?.qty);
    if (!isValidCost(item?.costPrice) || !Number.isFinite(quantity) || quantity < 0) {
      return null;
    }
    totalCogs += Number(item.costPrice) * quantity;
  }

  return roundMoney(totalCogs);
};

export const getSaleGrossProfit = (sale) => {
  const cogs = getSaleCogs(sale);
  const revenue = Number(sale?.total);
  if (cogs === null || !Number.isFinite(revenue)) return null;
  return roundMoney(revenue - cogs);
};
