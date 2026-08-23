export type AppRole =
  | "cast"
  | "team_manager"
  | "department_manager"
  | "business_manager"
  | "company_manager"
  | "chairman";

export function roleLevel(role?: string | null) {
  switch (role) {
    case "cast":
      return 1;

    case "team_manager":
      return 2;

    case "department_manager":
      return 3;

    case "business_manager":
      return 4;

    case "company_manager":
      return 5;

    case "chairman":
      return 6;

    default:
      return 0;
  }
}

/**
 * 個人目標を見る
 */
export function canViewPersonal(role?: string | null) {
  return roleLevel(role) >= 1;
}

/**
 * チーム管理
 * 部責以上
 */
export function canManageTeam(role?: string | null) {
  return roleLevel(role) >= 2;
}

/**
 * 営業部管理
 * 業責以上
 */
export function canManageDepartment(role?: string | null) {
  return roleLevel(role) >= 3;
}

/**
 * 店舗管理
 * 社責以上
 */
export function canManageStore(role?: string | null) {
  return roleLevel(role) >= 4;
}

/**
 * 会社全体管理
 */
export function canManageCompany(role?: string | null) {
  return roleLevel(role) >= 5;
}

/**
 * 最上位権限
 */
export function isChairman(role?: string | null) {
  return role === "chairman";
}

/**
 * 日報入力権限
 * キャスト本人は入力しない運用
 */
export function canEditDaily(role?: string | null) {
  return roleLevel(role) >= 2;
}

/**
 * 店舗目標設定
 */
export function canEditStoreGoal(role?: string | null) {
  return roleLevel(role) >= 4;
}

/**
 * 営業部目標設定
 */
export function canEditDepartmentGoal(role?: string | null) {
  return roleLevel(role) >= 3;
}

/**
 * チーム目標設定
 */
export function canEditTeamGoal(role?: string | null) {
  return roleLevel(role) >= 2;
}
