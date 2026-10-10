import type { PrivacyImpactCounts } from "./impact";

export type PrivacyPreviewResponse = {
  counts: PrivacyImpactCounts;
  scope: "rls-visible-only";
  destructiveActionEnabled: false;
};

export function isPrivacyPreviewResponse(value: unknown): value is PrivacyPreviewResponse {
  if (typeof value !== "object" || value === null) return false;
  const response = value as Record<string, unknown>;
  if (response.scope !== "rls-visible-only" || response.destructiveActionEnabled !== false) return false;
  if (typeof response.counts !== "object" || response.counts === null) return false;
  const counts = response.counts as Record<string, unknown>;
  return (["clientSalesRows", "clientRows", "dailyRowsWithSales", "clientTargetRows"] as const)
    .every((key) => typeof counts[key] === "number" && Number.isSafeInteger(counts[key]) && (counts[key] as number) >= 0);
}
