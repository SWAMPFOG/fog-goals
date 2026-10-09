import { summarizePrivacyImpact } from "./impact";
import { canPreviewPrivacyImpact } from "./permissions";

export function verifyPrivacyPreviewRules(): void {
  const summary = summarizePrivacyImpact({
    clientSalesRows: 274,
    clientRows: 107,
    dailyRowsWithSales: 134,
    clientTargetRows: 15,
  });
  if (summary.totalAffectedRows !== 515 || !summary.clientTargetsRequireReview) {
    throw new Error("Privacy impact summary failed");
  }
  for (const role of ["team_manager", "department_manager", "business_manager", "company_manager", "chairman"]) {
    if (!canPreviewPrivacyImpact(role)) throw new Error("Missing privileged role: " + role);
  }
  for (const role of ["member", "", "invalid"]) {
    if (canPreviewPrivacyImpact(role)) throw new Error("Unexpected access: " + role);
  }
  try {
    summarizePrivacyImpact({ clientSalesRows: -1, clientRows: 0, dailyRowsWithSales: 0, clientTargetRows: 0 });
    throw new Error("Negative input accepted");
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "Impact counts must be nonnegative safe integers") throw error;
  }
}
