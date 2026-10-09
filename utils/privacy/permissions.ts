import { normalizeRole } from "@/utils/permissions";

const PRIVILEGED_ROLES = new Set([
  "team_manager",
  "department_manager",
  "business_manager",
  "company_manager",
  "chairman",
]);

/**
 * Presentation-only role check. Never use this as authorization for writes.
 * Server-side actions must independently verify the authenticated user.
 */
export function canPreviewPrivacyImpact(role: string | null | undefined): boolean {
  return PRIVILEGED_ROLES.has(normalizeRole(role));
}
