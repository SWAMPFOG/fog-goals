export type AppRole =
  | "chairman"
  | "company_manager"
  | "business_manager"
  | "department_manager"
  | "team_manager"
  | "member";

const ROLE_ALIASES: Record<string, AppRole> = {
  chairman: "chairman",
  "会長": "chairman",

  company_manager: "company_manager",
  "社責": "company_manager",

  business_manager: "business_manager",
  "業責": "business_manager",
  "業務責任者": "business_manager",

  department_manager: "department_manager",
  "営業部責任者": "department_manager",

  team_manager: "team_manager",
  "部責": "team_manager",
  "チーム責任者": "team_manager",

  member: "member",
  "一般": "member",
  "キャスト": "member",
};

export function normalizeRole(
  role: string | null | undefined
): AppRole {
  if (!role) return "member";
  return ROLE_ALIASES[role.trim()] ?? "member";
}

export function canEditStoreGoal(
  role: string | null | undefined
) {
  const r = normalizeRole(role);

  return [
    "chairman",
    "company_manager",
  ].includes(r);
}

export function canEditDepartmentGoal(
  role: string | null | undefined
) {
  const r = normalizeRole(role);

  return [
    "chairman",
    "company_manager",
    "business_manager",
    "department_manager",
  ].includes(r);
}

export function canEditTeamGoal(
  role: string | null | undefined
) {
  const r = normalizeRole(role);

  return [
    "chairman",
    "company_manager",
    "business_manager",
    "department_manager",
    "team_manager",
  ].includes(r);
}

export function canEditMemberGoal(
  role: string | null | undefined
) {
  return normalizeRole(role) !== "member";
}
