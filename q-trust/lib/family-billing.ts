// Base fee, discounted per-child fee (the sibling discount applies only when a
// family has ≥2 enrolled children), and the family's total monthly amount.
export function computeFamilyBilling(
  fee: number,
  discountPercent: number,
  studentCount: number
) {
  const hasSiblings = studentCount >= 2
  const perChild = hasSiblings ? fee * (1 - discountPercent / 100) : fee
  return {
    perChildBase: fee,
    perChildDiscounted: Math.round(perChild * 100) / 100,
    discountApplied: hasSiblings && discountPercent > 0,
    familyTotal: Math.round(perChild * studentCount * 100) / 100,
  }
}
