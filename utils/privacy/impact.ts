export type PrivacyImpactCounts = {
  clientSalesRows: number;
  clientRows: number;
  dailyRowsWithSales: number;
  clientTargetRows: number;
};

export type PrivacyImpactSummary = {
  totalAffectedRows: number;
  clientTargetsRequireReview: boolean;
  counts: PrivacyImpactCounts;
};

/**
 * Read-only calculation for an administrator's impact preview.
 * This function performs no network requests or mutations.
 */
export function summarizePrivacyImpact(counts: PrivacyImpactCounts): PrivacyImpactSummary {
  const values = Object.values(counts);
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("Impact counts must be nonnegative safe integers");
  }
  return {
    counts,
    totalAffectedRows: counts.clientSalesRows + counts.clientRows + counts.dailyRowsWithSales,
    clientTargetsRequireReview: counts.clientTargetRows > 0,
  };
}
