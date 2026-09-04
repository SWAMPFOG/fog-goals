"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { normalizeRole } from "@/utils/permissions";

type DailyResult = {
  sales: number | null;
  champagne_count: number | null;
  visit_count: number | null;
  repeat_count: number | null;
  first_contact_count: number | null;
  send_count: number | null;
  inhouse_count: number | null;
};

type ScopeGoal = {
  target_sales: number;
  champagne_target: number;
  visit_count_target: number;
};

type UserProfile = {
  id: string;
  role: string;
  department_id: string | null;
  team_id: string | null;
  member_id: string | null;
  display_name: string | null;
};

type TeamMustProgress = {
  team_must_sales: number;
  team_existing_client_sales: number;
  team_must_rate: number;
  team_must_remaining: number;
};

function yen(value: number) {
  return `¥${Number(value || 0).toLocaleString("ja-JP")}`;
}

function currentMonth() {
  const d = new Date();

  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
  };
}

function rawRate(current: number, target: number) {
  if (target <= 0) return 0;

  return Math.round((current / target) * 1000) / 10;
}

function progressWidth(current: number, target: number) {
  if (target <= 0) return 0;

  return Math.min(100, (current / target) * 100);
}

function roleLabel(role?: string | null) {
  switch (normalizeRole(role ?? null)) {
    case "member":
      return "キャスト";

    case "team_manager":
      return "部責";

    case "department_manager":
      return "営業部責任者";

    case "business_manager":
      return "業責";

    case "company_manager":
      return "社責";

    case "chairman":
      return "会長";

    default:
      return "未設定";
  }
}

function scopeLabel(role?: string | null) {
  switch (normalizeRole(role ?? null)) {
    case "team_manager":
      return "自チーム";

    case "department_manager":
      return "担当営業部";

    case "business_manager":
    case "company_manager":
    case "chairman":
      return "店舗";

    default:
      return "月間";
  }
}

function goalLabel(role?: string | null) {
  switch (normalizeRole(role ?? null)) {
    case "team_manager":
      return "チーム売上目標";

    case "department_manager":
      return "営業部売上目標";

    case "business_manager":
    case "company_manager":
    case "chairman":
      return "店舗売上目標";

    default:
      return "売上目標";
  }
}

function isStoreManager(role?: string | null) {
  const normalized = normalizeRole(role ?? null);

  return [
    "business_manager",
    "company_manager",
    "chairman",
  ].includes(normalized);
}

export default function HomePage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [loading, setLoading] =
    useState(true);

  const [email, setEmail] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [results, setResults] =
    useState<DailyResult[]>([]);

  const [goal, setGoal] =
    useState<ScopeGoal | null>(null);

  const [
    teamMustProgress,
    setTeamMustProgress,
  ] =
    useState<TeamMustProgress | null>(
      null
    );

  const [
    resolvedDepartmentId,
    setResolvedDepartmentId,
  ] =
    useState<string | null>(
      null
    );

  const month = useMemo(
    () => currentMonth(),
    []
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage("");
      setTeamMustProgress(
        null
      );

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.replace(
          "/login"
        );

        return;
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, role, department_id, team_id, member_id, display_name"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (
        profileError ||
        !profileData
      ) {
        setErrorMessage(
          profileError?.message ??
            "プロフィールが見つかりません"
        );

        setLoading(false);

        return;
      }

      const p =
        profileData as UserProfile;

      const normalizedRole =
        normalizeRole(
          p.role ?? null
        );

      setProfile(p);

      setEmail(
        user.email ?? ""
      );

      if (
        normalizedRole ===
        "member"
      ) {
        setResults([]);
        setGoal(null);
        setLoading(false);

        return;
      }

      const startDate =
        `${month.key}-01`;

      const [
        year,
        monthNumber,
      ] = month.key
        .split("-")
        .map(Number);

      const nextDate =
        new Date(
          year,
          monthNumber,
          1
        );

      const nextMonth =
        `${nextDate.getFullYear()}-${String(
          nextDate.getMonth() +
            1
        ).padStart(
          2,
          "0"
        )}-01`;

      if (
        normalizedRole ===
        "team_manager"
      ) {
        if (!p.team_id) {
          setErrorMessage(
            "所属チームが設定されていません"
          );

          setLoading(false);

          return;
        }

        const [
          dailyResult,
          goalResult,
          mustResult,
        ] = await Promise.all([
          supabase
            .from(
              "daily_results"
            )
            .select(
              "sales, champagne_count, visit_count, repeat_count, first_contact_count, send_count, inhouse_count"
            )
            .eq(
              "team_id",
              p.team_id
            )
            .gte(
              "business_date",
              startDate
            )
            .lt(
              "business_date",
              nextMonth
            ),

          supabase
            .from(
              "team_goals"
            )
            .select(
              "target_sales, champagne_target, visit_count_target"
            )
            .eq(
              "team_id",
              p.team_id
            )
            .eq(
              "target_month",
              startDate
            )
            .maybeSingle(),

          supabase.rpc(
            "get_my_team_must_progress",
            {
              p_month:
                startDate,
            }
          ),
        ]);

        const firstError =
          dailyResult.error ||
          goalResult.error ||
          mustResult.error;

        if (firstError) {
          setErrorMessage(
            firstError.message
          );

          setLoading(false);

          return;
        }

        setResults(
          (dailyResult.data ??
            []) as DailyResult[]
        );

        setGoal(
          (goalResult.data ??
            null) as
            | ScopeGoal
            | null
        );

        const mustRow =
          (mustResult.data ??
            [])[0] as any;

        setTeamMustProgress(
          mustRow
            ? {
                team_must_sales:
                  Number(
                    mustRow.team_must_sales ??
                      0
                  ),

                team_existing_client_sales:
                  Number(
                    mustRow.team_existing_client_sales ??
                      0
                  ),

                team_must_rate:
                  Number(
                    mustRow.team_must_rate ??
                      0
                  ),

                team_must_remaining:
                  Number(
                    mustRow.team_must_remaining ??
                      0
                  ),
              }
            : null
        );

        setLoading(false);

        return;
      }

      if (
        normalizedRole ===
        "department_manager"
      ) {
        let departmentId =
          p.department_id ??
          null;

        if (
          !departmentId &&
          p.team_id
        ) {
          const {
            data: ownTeam,
            error:
              ownTeamError,
          } = await supabase
            .from("teams")
            .select(
              "department_id"
            )
            .eq(
              "id",
              p.team_id
            )
            .maybeSingle();

          if (
            ownTeamError
          ) {
            setErrorMessage(
              ownTeamError.message
            );

            setLoading(false);

            return;
          }

          departmentId =
            ownTeam?.department_id ??
            null;
        }

        if (!departmentId) {
          setErrorMessage(
            "担当営業部が設定されていません"
          );

          setLoading(false);

          return;
        }

        setResolvedDepartmentId(
          departmentId
        );

        const [
          teamResult,
          goalResult,
        ] = await Promise.all([
          supabase
            .from("teams")
            .select("id")
            .eq(
              "department_id",
              departmentId
            )
            .eq(
              "is_active",
              true
            ),

          supabase
            .from(
              "department_goals"
            )
            .select(
              "target_sales, champagne_target, visit_count_target"
            )
            .eq(
              "department_id",
              departmentId
            )
            .eq(
              "target_month",
              startDate
            )
            .maybeSingle(),
        ]);

        if (
          teamResult.error ||
          goalResult.error
        ) {
          setErrorMessage(
            teamResult.error
              ?.message ??
              goalResult.error
                ?.message ??
              "読込エラー"
          );

          setLoading(false);

          return;
        }

        const teamIds =
          (
            teamResult.data ??
            []
          ).map(
            (row) => row.id
          );

        if (
          teamIds.length ===
          0
        ) {
          setResults([]);

          setGoal(
            (goalResult.data ??
              null) as
              | ScopeGoal
              | null
          );

          setLoading(false);

          return;
        }

        const {
          data: dailyData,
          error: dailyError,
        } = await supabase
          .from(
            "daily_results"
          )
          .select(
            "sales, champagne_count, visit_count, repeat_count, first_contact_count, send_count, inhouse_count"
          )
          .in(
            "team_id",
            teamIds
          )
          .gte(
            "business_date",
            startDate
          )
          .lt(
            "business_date",
            nextMonth
          );

        if (dailyError) {
          setErrorMessage(
            dailyError.message
          );

          setLoading(false);

          return;
        }

        setResults(
          (dailyData ??
            []) as DailyResult[]
        );

        setGoal(
          (goalResult.data ??
            null) as
            | ScopeGoal
            | null
        );

        setLoading(false);

        return;
      }

      if (
        [
          "business_manager",
          "company_manager",
          "chairman",
        ].includes(
          normalizedRole
        )
      ) {
        const [
          dailyResult,
          goalResult,
        ] = await Promise.all([
          supabase
            .from(
              "daily_results"
            )
            .select(
              "sales, champagne_count, visit_count, repeat_count, first_contact_count, send_count, inhouse_count"
            )
            .gte(
              "business_date",
              startDate
            )
            .lt(
              "business_date",
              nextMonth
            ),

          supabase
            .from(
              "store_goals"
            )
            .select(
              "target_sales, champagne_target, visit_count_target"
            )
            .eq(
              "target_month",
              startDate
            )
            .maybeSingle(),
        ]);

        if (
          dailyResult.error ||
          goalResult.error
        ) {
          setErrorMessage(
            dailyResult.error
              ?.message ??
              goalResult.error
                ?.message ??
              "読込エラー"
          );

          setLoading(false);

          return;
        }

        setResults(
          (dailyResult.data ??
            []) as DailyResult[]
        );

        setGoal(
          (goalResult.data ??
            null) as
            | ScopeGoal
            | null
        );

        setLoading(false);

        return;
      }

      setErrorMessage(
        "このアカウントの役職設定を確認してください"
      );

      setLoading(false);
    }

    load();
  }, [
    router,
    supabase,
    month.key,
  ]);

  const totals =
    useMemo(() => {
      return results.reduce(
        (sum, row) => ({
          sales:
            sum.sales +
            Number(
              row.sales ?? 0
            ),

          champagne:
            sum.champagne +
            Number(
              row.champagne_count ??
                0
            ),

          visits:
            sum.visits +
            Number(
              row.visit_count ??
                0
            ),

          repeats:
            sum.repeats +
            Number(
              row.repeat_count ??
                0
            ),

          firstContacts:
            sum.firstContacts +
            Number(
              row.first_contact_count ??
                0
            ),

          sends:
            sum.sends +
            Number(
              row.send_count ??
                0
            ),

          inhouse:
            sum.inhouse +
            Number(
              row.inhouse_count ??
                0
            ),
        }),
        {
          sales: 0,
          champagne: 0,
          visits: 0,
          repeats: 0,
          firstContacts: 0,
          sends: 0,
          inhouse: 0,
        }
      );
    }, [results]);

  const normalizedRole =
    normalizeRole(
      profile?.role ??
        null
    );

  const storeView =
    isStoreManager(
      profile?.role ??
        null
    );

  const salesTarget =
    Number(
      goal?.target_sales ??
        0
    );

  const champagneTarget =
    Number(
      goal?.champagne_target ??
        0
    );

  const visitTarget =
    Number(
      goal?.visit_count_target ??
        0
    );

  const salesRate =
    rawRate(
      totals.sales,
      salesTarget
    );

  const champagneRate =
    rawRate(
      totals.champagne,
      champagneTarget
    );

  const visitRate =
    rawRate(
      totals.visits,
      visitTarget
    );

  const salesRemaining =
    Math.max(
      0,
      salesTarget -
        totals.sales
    );

  const salesOver =
    Math.max(
      0,
      totals.sales -
        salesTarget
    );

  const teamMustSales =
    Number(
      teamMustProgress
        ?.team_must_sales ??
        0
    );

  const teamExistingClientSales =
    Number(
      teamMustProgress
        ?.team_existing_client_sales ??
        0
    );

  const teamMustRate =
    Number(
      teamMustProgress
        ?.team_must_rate ??
        0
    );

  const teamMustRemaining =
    Number(
      teamMustProgress
        ?.team_must_remaining ??
        0
    );

  const teamMustOver =
    Math.max(
      0,
      teamExistingClientSales -
        teamMustSales
    );

  async function handleLogout() {
    await supabase.auth.signOut();

    router.replace(
      "/login"
    );

    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">
          読み込み中...
        </p>
      </main>
    );
  }

  if (
    normalizedRole ===
    "member"
  ) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto w-full max-w-md px-5 py-8">
          <header className="mb-10 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.3em] text-zinc-500">
                SWAMP-FOG
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                FOG GOALS
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {profile?.display_name ??
                  "CAST"}
              </p>
            </div>

            <button
              onClick={
                handleLogout
              }
              className="rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-400"
            >
              ログアウト
            </button>
          </header>

          {errorMessage && (
            <section className="mb-4 rounded-3xl border border-red-900 p-4">
              <p className="text-sm text-red-400">
                ERROR:{" "}
                {errorMessage}
              </p>
            </section>
          )}

          <section>
            <p className="text-xs tracking-[0.25em] text-zinc-500">
              MENU
            </p>

            <h2 className="mt-2 text-xl font-bold">
              見るページを選択
            </h2>

            <div className="mt-5 grid grid-cols-2 gap-4">
              {profile?.member_id ? (
                <Link
                  href={`/members/${profile.member_id}`}
                  className="flex min-h-36 flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
                >
                  <div>
                    <p className="text-xs text-zinc-500">
                      MY PAGE
                    </p>

                    <p className="mt-2 text-xl font-bold">
                      マイページ
                    </p>
                  </div>

                  <p className="text-sm text-zinc-500">
                    自分の目標・実績 →
                  </p>
                </Link>
              ) : (
                <div className="flex min-h-36 flex-col justify-between rounded-3xl border border-zinc-900 bg-zinc-950 p-5 opacity-50">
                  <div>
                    <p className="text-xs text-zinc-600">
                      MY PAGE
                    </p>

                    <p className="mt-2 text-xl font-bold">
                      マイページ
                    </p>
                  </div>

                  <p className="text-sm text-zinc-600">
                    未設定
                  </p>
                </div>
              )}

              {profile?.team_id ? (
                <Link
                  href={`/teams/${profile.team_id}`}
                  className="flex min-h-36 flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
                >
                  <div>
                    <p className="text-xs text-zinc-500">
                      TEAM
                    </p>

                    <p className="mt-2 text-xl font-bold">
                      チーム
                    </p>
                  </div>

                  <p className="text-sm text-zinc-500">
                    目標・ランキング →
                  </p>
                </Link>
              ) : (
                <div className="flex min-h-36 flex-col justify-between rounded-3xl border border-zinc-900 bg-zinc-950 p-5 opacity-50">
                  <div>
                    <p className="text-xs text-zinc-600">
                      TEAM
                    </p>

                    <p className="mt-2 text-xl font-bold">
                      チーム
                    </p>
                  </div>

                  <p className="text-sm text-zinc-600">
                    未設定
                  </p>
                </div>
              )}

              <Link
                href="/clients"
                className="col-span-2 flex min-h-28 items-center justify-between rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
              >
                <div>
                  <p className="text-xs text-zinc-500">
                    CLIENTS
                  </p>

                  <p className="mt-2 text-xl font-bold">
                    クライアント
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    売上・必達を確認
                  </p>
                </div>

                <span className="text-xl text-zinc-500">
                  →
                </span>
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white pb-28">
      <div className="mx-auto w-full max-w-md px-5 pt-4">
        <header className="sticky top-0 z-40 -mx-5 mb-5 border-b border-zinc-900 bg-black/90 px-5 pb-4 pt-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.3em] text-zinc-500">
                SWAMP-FOG
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                FOG GOALS
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {roleLabel(
                  profile?.role
                )}

                {profile?.display_name
                  ? `・${profile.display_name}`
                  : ""}
              </p>
            </div>

            <button
              onClick={
                handleLogout
              }
              className="rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-400"
            >
              ログアウト
            </button>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="truncate text-xs text-zinc-700">
              {email}
            </p>

            <div className="shrink-0 text-right">
              <p className="text-xs text-zinc-500">
                対象月
              </p>

              <p className="mt-1 font-bold">
                {month.label}
              </p>
            </div>
          </div>
        </header>

        {errorMessage && (
          <section className="mb-4 rounded-3xl border border-red-900 p-4">
            <p className="text-sm text-red-400">
              ERROR:{" "}
              {errorMessage}
            </p>
          </section>
        )}

        <section className="rounded-3xl border border-zinc-700 bg-zinc-950 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-zinc-500">
                {goalLabel(
                  profile?.role
                )}
              </p>

              <p className="mt-2 text-3xl font-bold">
                {salesTarget > 0
                  ? yen(
                      salesTarget
                    )
                  : "未設定"}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-zinc-500">
                達成率
              </p>

              <p className="mt-1 text-2xl font-bold">
                {salesTarget > 0
                  ? `${salesRate}%`
                  : "－"}
              </p>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-white"
              style={{
                width: `${progressWidth(
                  totals.sales,
                  salesTarget
                )}%`,
              }}
            />
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-zinc-500">
                現在売上
              </p>

              <p className="mt-1 text-xl font-bold">
                {yen(
                  totals.sales
                )}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-zinc-500">
                {salesTarget >
                  0 &&
                salesOver > 0
                  ? "目標超過"
                  : "残り"}
              </p>

              <p className="mt-1 text-lg font-bold">
                {salesTarget <=
                0
                  ? "－"
                  : salesOver > 0
                    ? `+${yen(
                        salesOver
                      )}`
                    : yen(
                        salesRemaining
                      )}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-3 grid grid-cols-2 gap-3">
          <GoalMiniBox
            label="オリシャン"
            current={`${totals.champagne}本`}
            target={
              champagneTarget >
              0
                ? `${champagneTarget}本`
                : "未設定"
            }
            rateValue={
              champagneRate
            }
          />

          <GoalMiniBox
            label="来店組数"
            current={`${totals.visits}組`}
            target={
              visitTarget > 0
                ? `${visitTarget}組`
                : "未設定"
            }
            rateValue={
              visitRate
            }
          />
        </section>

        {normalizedRole ===
          "team_manager" && (
          <section className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs text-zinc-500">
              TEAM MUST
            </p>

            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-400">
                  チーム必達
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {teamMustSales >
                  0
                    ? yen(
                        teamMustSales
                      )
                    : "未設定"}
                </p>
              </div>

              <p className="text-2xl font-bold">
                {teamMustSales >
                0
                  ? `${teamMustRate}%`
                  : "－"}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ResultBox
                label="既存顧客売上"
                value={yen(
                  teamExistingClientSales
                )}
              />

              <ResultBox
                label={
                  teamMustOver >
                  0
                    ? "必達超過"
                    : "残り"
                }
                value={
                  teamMustSales <=
                  0
                    ? "－"
                    : teamMustOver >
                        0
                      ? `+${yen(
                          teamMustOver
                        )}`
                      : yen(
                          teamMustRemaining
                        )
                }
              />
            </div>
          </section>
        )}

        <section className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs text-zinc-500">
            MONTHLY RESULT
          </p>

          <h2 className="mt-2 text-xl font-bold">
            {scopeLabel(
              profile?.role
            )}
            営業実績
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <ResultBox
              label="売上"
              value={yen(
                totals.sales
              )}
            />

            <ResultBox
              label="オリシャン"
              value={`${totals.champagne}本`}
            />

            <ResultBox
              label="来店組数"
              value={`${totals.visits}組`}
            />
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs text-zinc-500">
            SALES ACTION
          </p>

          <h2 className="mt-2 text-xl font-bold">
            営業指標
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <ResultBox
              label="リピート"
              value={`${totals.repeats}組`}
            />

            <ResultBox
              label="初回"
              value={`${totals.firstContacts}組`}
            />

            <ResultBox
              label="送り"
              value={`${totals.sends}件`}
            />

            <ResultBox
              label="場内"
              value={`${totals.inhouse}件`}
            />
          </div>
        </section>

        <section className="mt-5">
          <p className="text-xs tracking-[0.25em] text-zinc-500">
            MENU
          </p>

          <h2 className="mt-2 text-xl font-bold">
            管理メニュー
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {normalizedRole ===
              "team_manager" &&
              profile?.team_id && (
                <>
                  <MenuLink
                    href={`/teams/${profile.team_id}`}
                    label="自チーム"
                    sub="目標・必達・ランキング"
                  />

                  <MenuLink
                    href="/members"
                    label="メンバー"
                    sub="個人目標・実績"
                  />

                  <MenuLink
                    href="/clients"
                    label="クライアント"
                    sub="売上・必達"
                  />

                  <MenuLink
                    href="/daily"
                    label="日報"
                    sub="月間累計入力"
                  />
                </>
              )}

            {normalizedRole ===
              "department_manager" && (
                <>
                  {resolvedDepartmentId && (
                    <MenuLink
                      href={`/departments/${resolvedDepartmentId}`}
                      label="担当営業部"
                      sub="営業部目標・実績"
                    />
                  )}

                  <MenuLink
                    href="/teams"
                    label="チーム"
                    sub="担当チーム一覧"
                  />

                  <MenuLink
                    href="/clients"
                    label="クライアント"
                    sub="売上・必達"
                  />

                  <MenuLink
                    href="/daily"
                    label="日報"
                    sub="月間累計確認"
                  />
                </>
              )}

            {storeView && (
              <>
                <MenuLink
                  href="/teams"
                  label="全チーム"
                  sub="営業部・チーム"
                />

                <MenuLink
                  href="/members"
                  label="全メンバー"
                  sub="個人目標・実績"
                />

                <MenuLink
                  href="/clients"
                  label="クライアント"
                  sub="売上・必達"
                />

                <MenuLink
                  href="/daily"
                  label="日報"
                  sub="月間累計管理"
                />

                <MenuLink
                  href="/summary"
                  label="集約"
                  sub="管理ダッシュボード"
                  wide
                />

                <MenuLink
                  href="/settings"
                  label="設定"
                  sub="店舗目標設定"
                  wide
                />
              </>
            )}
          </div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 pt-1">
          <Link
            href="/"
            className="py-2.5 text-center text-[10px] font-bold text-white"
          >
            <span className="block text-lg leading-none">
              ⌂
            </span>

            <span className="mt-1 block">
              ホーム
            </span>
          </Link>

          <Link
            href="/members"
            className="py-2.5 text-center text-[10px] text-zinc-600"
          >
            <span className="block text-lg leading-none">
              ♙
            </span>

            <span className="mt-1 block">
              メンバー
            </span>
          </Link>

          <Link
            href="/daily"
            className="py-2.5 text-center text-[10px] text-zinc-600"
          >
            <span className="block text-lg leading-none">
              ✎
            </span>

            <span className="mt-1 block">
              日報
            </span>
          </Link>

          {storeView ? (
            <Link
              href="/settings"
              className="py-2.5 text-center text-[10px] text-zinc-600"
            >
              <span className="block text-lg leading-none">
                ⚙
              </span>

              <span className="mt-1 block">
                設定
              </span>
            </Link>
          ) : (
            <Link
              href="/clients"
              className="py-2.5 text-center text-[10px] text-zinc-600"
            >
              <span className="block text-lg leading-none">
                ◎
              </span>

              <span className="mt-1 block">
                顧客
              </span>
            </Link>
          )}
        </div>
      </nav>
    </main>
  );
}

function GoalMiniBox({
  label,
  current,
  target,
  rateValue,
}: {
  label: string;
  current: string;
  target: string;
  rateValue: number;
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {current}
      </p>

      <p className="mt-2 text-xs text-zinc-500">
        目標 {target}
      </p>

      <p className="mt-1 text-xs text-zinc-500">
        達成率{" "}
        {target ===
        "未設定"
          ? "－"
          : `${rateValue}%`}
      </p>
    </div>
  );
}

function ResultBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p className="mt-1 break-words text-xl font-bold">
        {value}
      </p>
    </div>
  );
}

function MenuLink({
  href,
  label,
  sub,
  wide = false,
}: {
  href: string;
  label: string;
  sub: string;
  wide?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`${
        wide
          ? "col-span-2"
          : ""
      } rounded-2xl border border-zinc-800 bg-zinc-950 p-4`}
    >
      <p className="font-bold">
        {label}
      </p>

      <p className="mt-1 text-xs text-zinc-500">
        {sub} →
      </p>
    </Link>
  );
}