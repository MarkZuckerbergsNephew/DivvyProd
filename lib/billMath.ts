export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function calculateTotals(
  items: { id: string; price?: number | null }[],
  claims: { item_id: string; participant_id: string; amount?: number }[],
  participants: { id: string }[],
  taxAmount: number,
  tipAmount: number
): Record<string, number> {
  const totals: Record<string, number> = {};

  participants.forEach(p => (totals[p.id] = 0));

  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.price ?? 0),
    0
  );

  items.forEach(item => {
    const claimers = claims.filter(c => c.item_id === item.id);

    claimers.forEach(c => {
      totals[c.participant_id] =
        (totals[c.participant_id] ?? 0) + roundMoney(Number(c.amount ?? 0));
    });
  });

  const extra = taxAmount + tipAmount;

  if (subtotal > 0 && extra > 0) {
    participants.forEach(p => {
      const ratio = totals[p.id] / subtotal;
      totals[p.id] = roundMoney(totals[p.id] + ratio * extra);
    });
  } else {
    Object.keys(totals).forEach(id => {
      totals[id] = roundMoney(totals[id]);
    });
  }

  return totals;
}
