"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { canEditTeamGoal, normalizeRole } from "@/utils/permissions";

type Team = {
  id: string;
  name: string;
  department_id: string | null;
};

type Member = {
  id: string;
  name: string;
  display_order: number;
};

type DailyResult = {
  member_id: string;
  sales: number | null;
  champagne_count: number | null;
  visit_count: number | null;
  repeat_count: number | null;
  first_contact_count: number | null;
  send_count: number | null;
  inhouse_count: number | null;
};

type TeamRankingRow = {
  member_id: string;
  member_name: string;
  sales_rank: number;
  sales_amount: number | null;
  champagne: number;
  visits: number;
  sends: number;
  inhouse: number;
  repeats: number;
  inhouse_rate: number;
  repeat_rate: number;
};

type ClientCountRankingRow = {
  member_id: string;
  member_name: string;
  client_count: number;
  client_rank: number;
};

type TeamSummary = {
  team_id: string;
  team_sales: number;
  team_champagne: number;
  team_visits: number;
  team_repeats: number;
  team_first_contacts: number;
  team_sends: number;
  team_inhouse: number;
  my_sales: number;
};

type TeamMustProgress = {
  team_must_sales: number;
  team_existing_client_sales: number;
  team_must_rate: number;
  team_must_remaining: number;
};

type TeamGoal = {
  id: string;
  target_sales: number;
  champagne_target: number;
  visit_count_target: number;
};

type MemberGoal = {
  member_id: string;
  must_sales: number | null;
  target_sales: number | null;
  champagne_target: number | null;
  visit_count_target: number | null;
};

type MemberStat = {
  id: string;
  name: string;
  salesRank: number;
  clientCountRank: number;
  sales: number;
  champagne: number;
  visits: number;
  clientCount: number;
  sends: number;
  inhouse: number;
  repeats: number;
  inhouseRate: number;
  repeatRate: number;
};

function currentMonth() {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

function yen(value: number) {
  return `¥${Number(value || 0).toLocaleString("ja-JP")}`;
}

function cappedRate(current: number, target: number) {
  if (target <= 0) return 0;

  return Math.min(
    100,
    Math.round((current / target) * 100)
  );
}

function rawRate(current: number, target: number) {
  if (target <= 0) return 0;

  return Math.round((current / target) * 1000) / 10;
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const [supabase] = useState(() => createClient());

  const [team, setTeam] =
    useState<Team | null>(null);

  const [teamName, setTeamName] =
    useState("");

  const [
    editingTeamName,
    setEditingTeamName,
  ] = useState(false);

  const [
    savingTeamName,
    setSavingTeamName,
  ] = useState(false);

  const [
    teamNameMessage,
    setTeamNameMessage,
  ] = useState("");

  const [members, setMembers] =
    useState<Member[]>([]);

  const [results, setResults] =
    useState<DailyResult[]>([]);

  const [
    rankingRows,
    setRankingRows,
  ] = useState<TeamRankingRow[]>([]);

  const [
    clientCountRows,
    setClientCountRows,
  ] = useState<ClientCountRankingRow[]>([]);

  const [
    teamSummary,
    setTeamSummary,
  ] = useState<TeamSummary | null>(null);

  const [
    teamMustProgress,
    setTeamMustProgress,
  ] = useState<TeamMustProgress | null>(null);

  const [goal, setGoal] =
    useState<TeamGoal | null>(null);

  const [
    memberGoals,
    setMemberGoals,
  ] = useState<MemberGoal[]>([]);

  const [month, setMonth] =
    useState(currentMonth());

  const [
    targetSales,
    setTargetSales,
  ] = useState("");

  const [
    champagneTarget,
    setChampagneTarget,
  ] = useState("");

  const [
    visitTarget,
    setVisitTarget,
  ] = useState("");

  const [editing, setEditing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [role, setRole] =
    useState<string | null>(null);

  const [
    profileTeamId,
    setProfileTeamId,
  ] = useState<string | null>(null);

  const [
    profileDepartmentId,
    setProfileDepartmentId,
  ] = useState<string | null>(null);

  const [
    accessDenied,
    setAccessDenied,
  ] = useState(false);

  const [rankTab, setRankTab] =
    useState("sales");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage("");
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "role, member_id, team_id"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setErrorMessage(profileError.message);
        setLoading(false);
        return;
      }

      const normalizedRole =
        normalizeRole(
          profileData?.role ?? null
        );

      setRole(
        profileData?.role ?? null
      );

      setProfileTeamId(
        profileData?.team_id ?? null
      );

      let ownDepartmentId:
        | string
        | null = null;

      if (profileData?.team_id) {
        const {
          data: ownTeam,
          error: ownTeamError,
        } = await supabase
          .from("teams")
          .select("department_id")
          .eq(
            "id",
            profileData.team_id
          )
          .maybeSingle();

        if (ownTeamError) {
          setErrorMessage(
            ownTeamError.message
          );
          setLoading(false);
          return;
        }

        ownDepartmentId =
          ownTeam?.department_id ??
          null;
      }

      setProfileDepartmentId(
        ownDepartmentId
      );

      const targetMonth =
        `${month}-01`;

      const [year, monthNumber] =
        month.split("-").map(Number);

      const nextDate =
        new Date(
          year,
          monthNumber,
          1
        );

      const nextMonth =
        `${nextDate.getFullYear()}-${String(
          nextDate.getMonth() + 1
        ).padStart(2, "0")}-01`;

      const [
        teamResult,
        membersResult,
        dailyResult,
        goalResult,
        memberGoalResult,
      ] = await Promise.all([
        supabase
          .from("teams")
          .select(
            "id, name, department_id"
          )
          .eq("id", teamId)
          .eq("is_active", true)
          .single(),

        supabase
          .from("members")
          .select(
            "id, name, display_order"
          )
          .eq(
            "team_id",
            teamId
          )
          .eq(
            "is_active",
            true
          )
          .order(
            "display_order"
          ),

        supabase
          .from("daily_results")
          .select(
            "member_id, sales, champagne_count, visit_count, repeat_count, first_contact_count, send_count, inhouse_count"
          )
          .eq(
            "team_id",
            teamId
          )
          .gte(
            "business_date",
            targetMonth
          )
          .lt(
            "business_date",
            nextMonth
          ),

        supabase
          .from("team_goals")
          .select(
            "id, target_sales, champagne_target, visit_count_target"
          )
          .eq(
            "team_id",
            teamId
          )
          .eq(
            "target_month",
            targetMonth
          )
          .maybeSingle(),

        supabase
          .from("monthly_goals")
          .select(
            "member_id, must_sales, target_sales, champagne_target, visit_count_target"
          )
          .eq(
            "team_id",
            teamId
          )
          .eq(
            "target_month",
            targetMonth
          ),
      ]);

      const firstError =
        teamResult.error ||
        membersResult.error ||
        dailyResult.error ||
        goalResult.error ||
        memberGoalResult.error;

      if (firstError) {
        setErrorMessage(
          firstError.message
        );
        setLoading(false);
        return;
      }

      let canViewThisTeam =
        true;

      if (
        normalizedRole ===
          "member" ||
        normalizedRole ===
          "team_manager"
      ) {
        canViewThisTeam =
          profileData?.team_id ===
          teamId;
      } else if (
        normalizedRole ===
        "department_manager"
      ) {
        canViewThisTeam =
          !!ownDepartmentId &&
          ownDepartmentId ===
            teamResult.data
              .department_id;
      }

      if (!canViewThisTeam) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setAccessDenied(false);

      setTeam(
        teamResult.data
      );

      setTeamName(
        teamResult.data?.name ??
          ""
      );

      setMembers(
        (membersResult.data ??
          []) as Member[]
      );

      setResults(
        (dailyResult.data ??
          []) as DailyResult[]
      );

      setMemberGoals(
        (memberGoalResult.data ??
          []) as MemberGoal[]
      );

      if (goalResult.data) {
        setGoal(
          goalResult.data
        );

        setTargetSales(
          String(
            goalResult.data
              .target_sales ??
              0
          )
        );

        setChampagneTarget(
          String(
            goalResult.data
              .champagne_target ??
              0
          )
        );

        setVisitTarget(
          String(
            goalResult.data
              .visit_count_target ??
              0
          )
        );
      } else {
        setGoal(null);
        setTargetSales("");
        setChampagneTarget("");
        setVisitTarget("");
      }

      if (
        normalizedRole ===
        "member"
      ) {
        const [
          rankingRes,
          summaryRes,
          clientRes,
          mustRes,
        ] = await Promise.all([
          supabase.rpc(
            "get_my_team_ranking",
            {
              p_month:
                targetMonth,
            }
          ),

          supabase.rpc(
            "get_my_team_summary",
            {
              p_month:
                targetMonth,
            }
          ),

          supabase.rpc(
            "get_my_team_client_count_ranking",
            {
              p_month:
                targetMonth,
            }
          ),

          supabase.rpc(
            "get_my_team_must_progress",
            {
              p_month:
                targetMonth,
            }
          ),
        ]);

        const rpcError =
          rankingRes.error ||
          summaryRes.error ||
          clientRes.error ||
          mustRes.error;

        if (rpcError) {
          setErrorMessage(
            rpcError.message
          );
          setLoading(false);
          return;
        }

        setRankingRows(
          (rankingRes.data ??
            []) as TeamRankingRow[]
        );

        setTeamSummary(
          ((summaryRes.data ??
            [])[0] ??
            null) as
            | TeamSummary
            | null
        );

        setClientCountRows(
          (clientRes.data ??
            []).map(
            (row: any) => ({
              member_id:
                row.member_id,

              member_name:
                row.member_name,

              client_count:
                Number(
                  row.client_count ??
                    0
                ),

              client_rank:
                Number(
                  row.client_rank ??
                    0
                ),
            })
          )
        );

        const mustRow =
          (mustRes.data ??
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
      } else {
        setRankingRows([]);
        setTeamSummary(null);

        const {
          data: clientSalesData,
          error:
            clientSalesError,
        } = await supabase
          .from("client_sales")
          .select(
            "member_id, client_id, amount, visit_type"
          )
          .eq(
            "team_id",
            teamId
          )
          .gte(
            "visit_date",
            targetMonth
          )
          .lt(
            "visit_date",
            nextMonth
          );

        if (
          clientSalesError
        ) {
          setErrorMessage(
            clientSalesError.message
          );
          setLoading(false);
          return;
        }

        const countMap =
          new Map<
            string,
            Set<string>
          >();

        let mustSalesTotal = 0;

        for (
          const row of
            clientSalesData ??
            []
        ) {
          if (
            !row.member_id ||
            !row.client_id
          ) {
            continue;
          }

          mustSalesTotal +=
            Number(
              row.amount ?? 0
            );

          if (
            row.visit_type !==
            "existing"
          ) {
            continue;
          }

          if (
            !countMap.has(
              row.member_id
            )
          ) {
            countMap.set(
              row.member_id,
              new Set<string>()
            );
          }

          countMap
            .get(
              row.member_id
            )!
            .add(
              row.client_id
            );
        }

        const counts =
          (
            (
              membersResult.data ??
              []
            ) as Member[]
          )
            .map(
              (member) => ({
                member_id:
                  member.id,

                member_name:
                  member.name,

                client_count:
                  countMap.get(
                    member.id
                  )?.size ?? 0,

                client_rank:
                  0,
              })
            )
            .sort(
              (a, b) =>
                b.client_count -
                  a.client_count ||
                a.member_name.localeCompare(
                  b.member_name,
                  "ja"
                )
            );

        let previousCount:
          | number
          | null = null;

        let currentRank = 0;

        const rankedCounts =
          counts.map(
            (row, index) => {
              if (
                previousCount !==
                row.client_count
              ) {
                currentRank =
                  index + 1;

                previousCount =
                  row.client_count;
              }

              return {
                ...row,
                client_rank:
                  currentRank,
              };
            }
          );

        setClientCountRows(
          rankedCounts
        );

        const teamMust =
          (
            memberGoalResult.data ??
            []
          ).reduce(
            (sum, row) =>
              sum +
              Number(
                row.must_sales ??
                  0
              ),
            0
          );

        setTeamMustProgress({
          team_must_sales:
            teamMust,

          team_existing_client_sales:
            mustSalesTotal,

          team_must_rate:
            rawRate(
              mustSalesTotal,
              teamMust
            ),

          team_must_remaining:
            Math.max(
              0,
              teamMust -
                mustSalesTotal
            ),
        });
      }

      setLoading(false);
    }

    if (teamId) {
      load();
    }
  }, [
    teamId,
    month,
    router,
    supabase,
  ]);

  const directTotals =
    useMemo(
      () =>
        results.reduce(
          (sum, row) => ({
            sales:
              sum.sales +
              Number(
                row.sales ??
                  0
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
        ),
      [results]
    );

  const normalizedRole =
    normalizeRole(role);

  const totals =
    normalizedRole ===
      "member" &&
    teamSummary
      ? {
          sales:
            Number(
              teamSummary.team_sales ??
                0
            ),

          champagne:
            Number(
              teamSummary.team_champagne ??
                0
            ),

          visits:
            Number(
              teamSummary.team_visits ??
                0
            ),

          repeats:
            Number(
              teamSummary.team_repeats ??
                0
            ),

          firstContacts:
            Number(
              teamSummary.team_first_contacts ??
                0
            ),

          sends:
            Number(
              teamSummary.team_sends ??
                0
            ),

          inhouse:
            Number(
              teamSummary.team_inhouse ??
                0
            ),
        }
      : directTotals;

  const memberStats =
    useMemo<
      MemberStat[]
    >(() => {
      if (
        normalizeRole(
          role
        ) === "member"
      ) {
        return rankingRows.map(
          (row) => {
            const clientRow =
              clientCountRows.find(
                (x) =>
                  x.member_id ===
                  row.member_id
              );

            return {
              id:
                row.member_id,

              name:
                row.member_name,

              salesRank:
                Number(
                  row.sales_rank ??
                    0
                ),

              clientCountRank:
                Number(
                  clientRow?.client_rank ??
                    0
                ),

              sales:
                Number(
                  row.sales_amount ??
                    0
                ),

              champagne:
                Number(
                  row.champagne ??
                    0
                ),

              visits:
                Number(
                  row.visits ??
                    0
                ),

              clientCount:
                Number(
                  clientRow?.client_count ??
                    0
                ),

              sends:
                Number(
                  row.sends ??
                    0
                ),

              inhouse:
                Number(
                  row.inhouse ??
                    0
                ),

              repeats:
                Number(
                  row.repeats ??
                    0
                ),

              inhouseRate:
                Number(
                  row.inhouse_rate ??
                    0
                ),

              repeatRate:
                Number(
                  row.repeat_rate ??
                    0
                ),
            };
          }
        );
      }

      return members.map(
        (member) => {
          const agg =
            results
              .filter(
                (row) =>
                  row.member_id ===
                  member.id
              )
              .reduce(
                (
                  sum,
                  row
                ) => ({
                  sales:
                    sum.sales +
                    Number(
                      row.sales ??
                        0
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

                  repeats:
                    sum.repeats +
                    Number(
                      row.repeat_count ??
                        0
                    ),
                }),
                {
                  sales: 0,
                  champagne: 0,
                  visits: 0,
                  sends: 0,
                  inhouse: 0,
                  repeats: 0,
                }
              );

          const clientRow =
            clientCountRows.find(
              (x) =>
                x.member_id ===
                member.id
            );

          return {
            id:
              member.id,

            name:
              member.name,

            salesRank:
              0,

            clientCountRank:
              Number(
                clientRow?.client_rank ??
                  0
              ),

            sales:
              agg.sales,

            champagne:
              agg.champagne,

            visits:
              agg.visits,

            clientCount:
              Number(
                clientRow?.client_count ??
                  0
              ),

            sends:
              agg.sends,

            inhouse:
              agg.inhouse,

            repeats:
              agg.repeats,

            inhouseRate:
              agg.sends > 0
                ? (agg.inhouse /
                    agg.sends) *
                  100
                : 0,

            repeatRate:
              agg.sends > 0
                ? (agg.repeats /
                    agg.sends) *
                  100
                : 0,
          };
        }
      );
    }, [
      members,
      results,
      rankingRows,
      clientCountRows,
      role,
    ]);

  const teamClientCount =
    clientCountRows.reduce(
      (sum, row) =>
        sum +
        Number(
          row.client_count ??
            0
        ),
      0
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

  const salesTarget =
    Number(
      goal?.target_sales ??
        0
    );

  const champagneGoal =
    Number(
      goal?.champagne_target ??
        0
    );

  const visitGoal =
    Number(
      goal?.visit_count_target ??
        0
    );

  const myTeamContributionRate =
    normalizedRole ===
      "member" &&
    salesTarget > 0
      ? Math.round(
          (Number(
            teamSummary?.my_sales ??
              0
          ) /
            salesTarget) *
            1000
        ) / 10
      : 0;

  const canEditThisTeam =
    canEditTeamGoal(role) &&
    (normalizedRole ===
    "team_manager"
      ? !!profileTeamId &&
        profileTeamId ===
          teamId

      : normalizedRole ===
        "department_manager"
        ? !!profileDepartmentId &&
          !!team?.department_id &&
          profileDepartmentId ===
            team.department_id

        : normalizedRole !==
          "member");

  const memberGoalTotals =
    useMemo(
      () =>
        memberGoals.reduce(
          (sum, row) => ({
            mustSales:
              sum.mustSales +
              Number(
                row.must_sales ??
                  0
              ),

            sales:
              sum.sales +
              Number(
                row.target_sales ??
                  0
              ),

            champagne:
              sum.champagne +
              Number(
                row.champagne_target ??
                  0
              ),

            visits:
              sum.visits +
              Number(
                row.visit_count_target ??
                  0
              ),
          }),
          {
            mustSales: 0,
            sales: 0,
            champagne: 0,
            visits: 0,
          }
        ),
      [memberGoals]
    );

  const unallocatedSales =
    Math.max(
      0,
      salesTarget -
        memberGoalTotals.sales
    );

  const unallocatedChampagne =
    Math.max(
      0,
      champagneGoal -
        memberGoalTotals.champagne
    );

  const unallocatedVisits =
    Math.max(
      0,
      visitGoal -
        memberGoalTotals.visits
    );

  async function saveTeamName() {
    if (!canEditThisTeam) {
      return;
    }

    const nextName =
      teamName.trim();

    if (!nextName) {
      setTeamNameMessage(
        "チーム名を入力してください"
      );
      return;
    }

    setSavingTeamName(true);
    setTeamNameMessage("");

    const {
      data,
      error,
    } = await supabase
      .from("teams")
      .update({
        name: nextName,
      })
      .eq(
        "id",
        teamId
      )
      .select(
        "id, name, department_id"
      )
      .single();

    if (error) {
      setTeamNameMessage(
        `ERROR: ${error.message}`
      );

      setSavingTeamName(false);
      return;
    }

    setTeam(data);
    setTeamName(data.name);
    setEditingTeamName(false);

    setTeamNameMessage(
      "チーム名を変更しました"
    );

    setSavingTeamName(false);
  }

  async function saveGoal() {
    if (!canEditThisTeam) {
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    const payload = {
      team_id: teamId,
      target_month:
        `${month}-01`,
      target_sales:
        Number(
          targetSales || 0
        ),
      champagne_target:
        Number(
          champagneTarget ||
            0
        ),
      visit_count_target:
        Number(
          visitTarget || 0
        ),
      updated_at:
        new Date().toISOString(),
    };

    const {
      data,
      error,
    } = await supabase
      .from("team_goals")
      .upsert(
        payload,
        {
          onConflict:
            "team_id,target_month",
        }
      )
      .select(
        "id, target_sales, champagne_target, visit_count_target"
      )
      .single();

    if (error) {
      setErrorMessage(
        error.message
      );

      setSaving(false);
      return;
    }

    setGoal(data);
    setMessage(
      "保存しました"
    );
    setEditing(false);
    setSaving(false);
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

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-black text-white px-5 py-8">
        <div className="mx-auto max-w-md">
          <Link
            href="/teams"
            className="text-sm text-zinc-500"
          >
            ← チーム一覧
          </Link>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-lg font-bold">
              閲覧権限がありません
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              このアカウントでは、このチームの情報を閲覧できません。
            </p>
          </div>
        </div>
      </main>
    );
  }

  const canViewSalesAmount =
    normalizedRole !==
    "member";

  const rankingTabs: {
    key: string;
    label: string;
    getValue: (
      m: MemberStat
    ) => number;
    format: (
      v: number
    ) => string;
  }[] = [
    {
      key: "sales",
      label: "売上",
      getValue: (m) =>
        m.sales,
      format: (v) =>
        canViewSalesAmount
          ? yen(v)
          : "",
    },
    {
      key: "champagne",
      label: "オリシャン",
      getValue: (m) =>
        m.champagne,
      format: (v) =>
        `${v}本`,
    },
    {
      key: "visits",
      label: "来店",
      getValue: (m) =>
        m.visits,
      format: (v) =>
        `${v}組`,
    },
    {
      key: "clientCount",
      label: "顧客数",
      getValue: (m) =>
        m.clientCount,
      format: (v) =>
        `${v}人`,
    },
    {
      key: "sends",
      label: "送り",
      getValue: (m) =>
        m.sends,
      format: (v) =>
        `${v}件`,
    },
    {
      key: "inhouse",
      label: "場内",
      getValue: (m) =>
        m.inhouse,
      format: (v) =>
        `${v}件`,
    },
    {
      key: "inhouseRate",
      label: "場内率",
      getValue: (m) =>
        m.inhouseRate,
      format: (v) =>
        `${
          Math.round(
            v * 10
          ) / 10
        }%`,
    },
    {
      key: "repeats",
      label: "リピート",
      getValue: (m) =>
        m.repeats,
      format: (v) =>
        `${v}組`,
    },
    {
      key: "repeatRate",
      label: "リピート率",
      getValue: (m) =>
        m.repeatRate,
      format: (v) =>
        `${
          Math.round(
            v * 10
          ) / 10
        }%`,
    },
  ];

  const activeTab =
    rankingTabs.find(
      (tab) =>
        tab.key ===
        rankTab
    ) ??
    rankingTabs[0];

  const rankedMembers =
    normalizedRole ===
      "member" &&
    rankTab ===
      "sales"
      ? [
          ...memberStats,
        ].sort(
          (a, b) =>
            a.salesRank -
              b.salesRank ||
            a.name.localeCompare(
              b.name,
              "ja"
            )
        )

      : normalizedRole ===
          "member" &&
        rankTab ===
          "clientCount"
        ? [
            ...memberStats,
          ].sort(
            (a, b) =>
              a.clientCountRank -
                b.clientCountRank ||
              a.name.localeCompare(
                b.name,
                "ja"
              )
          )

        : [
            ...memberStats,
          ].sort(
            (a, b) => {
              const diff =
                activeTab.getValue(
                  b
                ) -
                activeTab.getValue(
                  a
                );

              return diff !==
                0
                ? diff
                : a.name.localeCompare(
                    b.name,
                    "ja"
                  );
            }
          );

  function rankLabel(
    index: number
  ) {
    if (index === 0) {
      return "🥇";
    }

    if (index === 1) {
      return "🥈";
    }

    if (index === 2) {
      return "🥉";
    }

    return `${index + 1}位`;
  }

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <div className="mx-auto w-full max-w-md px-5 pt-8">
        {normalizedRole ===
        "member" ? (
          <Link
            href="/"
            className="text-sm text-zinc-500"
          >
            ← ホーム
          </Link>
        ) : (
          <Link
            href="/teams"
            className="text-sm text-zinc-500"
          >
            ← チーム一覧
          </Link>
        )}

        <header className="mt-6 mb-6">
          <p className="text-xs tracking-[0.3em] text-zinc-500">
            SWAMP-FOG
          </p>

          <div className="mt-2 flex items-center justify-between gap-3">
            <h1 className="text-3xl font-bold">
              {team?.name ??
                "TEAM"}
            </h1>

            {canEditThisTeam &&
              !editingTeamName && (
                <button
                  onClick={() => {
                    setTeamName(
                      team?.name ??
                        ""
                    );

                    setTeamNameMessage(
                      ""
                    );

                    setEditingTeamName(
                      true
                    );
                  }}
                  className="shrink-0 rounded-xl border border-zinc-700 px-3 py-2 text-xs"
                >
                  チーム名変更
                </button>
              )}
          </div>

          {editingTeamName &&
            canEditThisTeam && (
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <input
                  value={
                    teamName
                  }
                  onChange={(e) =>
                    setTeamName(
                      e.target.value
                    )
                  }
                  placeholder="チーム名"
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white"
                />

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setTeamName(
                        team?.name ??
                          ""
                      );

                      setTeamNameMessage(
                        ""
                      );

                      setEditingTeamName(
                        false
                      );
                    }}
                    className="rounded-xl border border-zinc-700 py-3 text-sm"
                  >
                    キャンセル
                  </button>

                  <button
                    onClick={
                      saveTeamName
                    }
                    disabled={
                      savingTeamName
                    }
                    className="rounded-xl bg-white py-3 text-sm font-bold text-black disabled:opacity-50"
                  >
                    {savingTeamName
                      ? "保存中..."
                      : "保存"}
                  </button>
                </div>
              </div>
            )}

          {teamNameMessage && (
            <p
              className={`mt-2 text-xs ${
                teamNameMessage.startsWith(
                  "ERROR"
                )
                  ? "text-red-400"
                  : "text-green-400"
              }`}
            >
              {teamNameMessage}
            </p>
          )}

          <p className="mt-1 text-sm text-zinc-500">
            TEAM GOAL
          </p>
        </header>

        <label className="block mb-4">
          <span className="text-xs text-zinc-500">
            対象月
          </span>

          <input
            type="month"
            value={month}
            onChange={(e) =>
              setMonth(
                e.target.value
              )
            }
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
          />
        </label>

        {errorMessage && (
          <section className="mb-4 rounded-2xl border border-red-900 p-4">
            <p className="text-sm text-red-400">
              ERROR:{" "}
              {errorMessage}
            </p>
          </section>
        )}

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">
                チーム売上目標
              </p>

              <p className="mt-2 text-3xl font-bold">
                {goal
                  ? yen(
                      salesTarget
                    )
                  : "未設定"}
              </p>
            </div>

            {canEditThisTeam ? (
              <button
                onClick={() =>
                  setEditing(
                    !editing
                  )
                }
                className="rounded-xl border border-zinc-700 px-3 py-2 text-xs"
              >
                {editing
                  ? "閉じる"
                  : "目標設定"}
              </button>
            ) : normalizedRole !==
              "member" ? (
              <span className="text-xs text-zinc-600">
                閲覧のみ
              </span>
            ) : null}
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-white"
              style={{
                width: `${cappedRate(
                  totals.sales,
                  salesTarget
                )}%`,
              }}
            />
          </div>

          <div className="mt-3 flex justify-between text-xs text-zinc-500">
            <span>
              現在{" "}
              {yen(
                totals.sales
              )}
            </span>

            <span>
              達成率{" "}
              {rawRate(
                totals.sales,
                salesTarget
              )}
              %
            </span>
          </div>

          <p className="mt-4 text-sm text-zinc-400">
            残り{" "}
            {yen(
              Math.max(
                0,
                salesTarget -
                  totals.sales
              )
            )}
          </p>
        </section>

        <section className="mt-3 grid grid-cols-2 gap-3">
          <GoalMiniBox
            label="オリシャン目標"
            target={
              goal
                ? `${champagneGoal}本`
                : "未設定"
            }
            current={`現在 ${totals.champagne}本`}
            remaining={
              goal
                ? `残り ${Math.max(
                    0,
                    champagneGoal -
                      totals.champagne
                  )}本`
                : "残り －"
            }
          />

          <GoalMiniBox
            label="来店組数目標"
            target={
              goal
                ? `${visitGoal}組`
                : "未設定"
            }
            current={`現在 ${totals.visits}組`}
            remaining={
              goal
                ? `残り ${Math.max(
                    0,
                    visitGoal -
                      totals.visits
                  )}組`
                : "残り －"
            }
          />
        </section>

        {normalizedRole ===
          "member" && (
          <section className="mt-3 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs text-zinc-500">
              MY TEAM CONTRIBUTION
            </p>

            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-400">
                  自分のチーム貢献率
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {salesTarget >
                  0
                    ? `${myTeamContributionRate}%`
                    : "－"}
                </p>
              </div>

              <p className="text-right text-xs text-zinc-500">
                チーム売上目標に対する
                <br />
                自分の売上の割合
              </p>
            </div>
          </section>
        )}

        {editing &&
          canEditThisTeam && (
            <section className="mt-4 rounded-3xl border border-zinc-700 bg-zinc-950 p-5">
              <p className="text-lg font-bold">
                チーム目標設定
              </p>

              <div className="mt-5 space-y-4">
                <input
                  type="number"
                  value={
                    targetSales
                  }
                  onChange={(e) =>
                    setTargetSales(
                      e.target.value
                    )
                  }
                  placeholder="売上目標"
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3"
                />

                <input
                  type="number"
                  value={
                    champagneTarget
                  }
                  onChange={(e) =>
                    setChampagneTarget(
                      e.target.value
                    )
                  }
                  placeholder="オリシャン目標"
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3"
                />

                <input
                  type="number"
                  value={
                    visitTarget
                  }
                  onChange={(e) =>
                    setVisitTarget(
                      e.target.value
                    )
                  }
                  placeholder="来店組数目標"
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3"
                />

                <button
                  onClick={
                    saveGoal
                  }
                  disabled={
                    saving
                  }
                  className="w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
                >
                  {saving
                    ? "保存中..."
                    : "保存する"}
                </button>

                {message && (
                  <p className="text-center text-sm text-green-400">
                    {message}
                  </p>
                )}
              </div>
            </section>
          )}

        <section className="mt-6 rounded-3xl border border-zinc-700 bg-zinc-950 p-5">
          <p className="text-xs text-zinc-500">
            TEAM MUST
          </p>

          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-400">
                チーム必達
              </p>

              <p className="mt-1 text-3xl font-bold">
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

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-white"
              style={{
                width: `${Math.min(
                  100,
                  teamMustRate
                )}%`,
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <TeamResultBox
              label="必達対象売上"
              value={yen(
                teamExistingClientSales
              )}
            />

            <TeamResultBox
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

          <p className="mt-3 text-xs text-zinc-600">
            ※ 必達には既存・場内・新規お連れ様の売上すべてを含みます。
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs text-zinc-500">
            TEAM MONTHLY RESULT
          </p>

          <h2 className="mt-2 text-xl font-bold">
            チーム月間営業実績
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <TeamResultBox
              label="来店組数"
              value={`${totals.visits}組`}
            />

            <TeamResultBox
              label="顧客数"
              value={`${teamClientCount}人`}
            />

            <TeamResultBox
              label="リピート"
              value={`${totals.repeats}組`}
            />

            <TeamResultBox
              label="初回"
              value={`${totals.firstContacts}組`}
            />

            <TeamResultBox
              label="送り"
              value={`${totals.sends}件`}
            />

            <TeamResultBox
              label="場内"
              value={`${totals.inhouse}件`}
            />
          </div>

          <p className="mt-3 text-xs text-zinc-600">
            ※ 顧客数は「既存」のみ。場内・新規お連れ様は含みません。
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs text-zinc-500">
            TEAM RANKING
          </p>

          <h2 className="mt-2 text-xl font-bold">
            チーム内ランキング
          </h2>

          <div className="mt-4 -mx-5 overflow-x-auto px-5">
            <div className="flex gap-2 whitespace-nowrap">
              {rankingTabs.map(
                (tab) => (
                  <button
                    key={
                      tab.key
                    }
                    onClick={() =>
                      setRankTab(
                        tab.key
                      )
                    }
                    className={`rounded-full border px-4 py-2 text-sm ${
                      tab.key ===
                      rankTab
                        ? "border-white bg-white font-bold text-black"
                        : "border-zinc-800 bg-black text-zinc-400"
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {rankedMembers.length ===
            0 ? (
              <p className="text-sm text-zinc-500">
                メンバーがいません
              </p>
            ) : (
              rankedMembers.map(
                (
                  member,
                  index
                ) => (
                  <div
                    key={
                      member.id
                    }
                    className="flex items-center justify-between rounded-2xl bg-zinc-900 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center text-lg font-bold">
                        {normalizedRole ===
                          "member" &&
                        rankTab ===
                          "sales"
                          ? rankLabel(
                              Math.max(
                                0,
                                member.salesRank -
                                  1
                              )
                            )
                          : normalizedRole ===
                                "member" &&
                              rankTab ===
                                "clientCount"
                            ? rankLabel(
                                Math.max(
                                  0,
                                  member.clientCountRank -
                                    1
                                )
                              )
                            : rankLabel(
                                index
                              )}
                      </span>

                      <span className="text-sm font-bold">
                        {
                          member.name
                        }
                      </span>
                    </div>

                    <span className="text-sm font-bold">
                      {activeTab.format(
                        activeTab.getValue(
                          member
                        )
                      )}
                    </span>
                  </div>
                )
              )
            )}
          </div>
        </section>

        {normalizedRole !==
          "member" && (
          <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs text-zinc-500">
              GOAL ALLOCATION
            </p>

            <h2 className="mt-2 text-xl font-bold">
              個人目標への配分状況
            </h2>

            <div className="mt-5 space-y-5">
              <AllocationRow
                label="売上"
                team={yen(
                  salesTarget
                )}
                individual={yen(
                  memberGoalTotals.sales
                )}
                unallocated={
                  unallocatedSales >
                  0
                    ? yen(
                        unallocatedSales
                      )
                    : "✓ 配分完了"
                }
              />

              <AllocationRow
                label="オリシャン"
                team={`${champagneGoal}本`}
                individual={`${memberGoalTotals.champagne}本`}
                unallocated={
                  unallocatedChampagne >
                  0
                    ? `${unallocatedChampagne}本`
                    : "✓ 配分完了"
                }
              />

              <AllocationRow
                label="来店組数"
                team={`${visitGoal}組`}
                individual={`${memberGoalTotals.visits}組`}
                unallocated={
                  unallocatedVisits >
                  0
                    ? `${unallocatedVisits}組`
                    : "✓ 配分完了"
                }
              />
            </div>
          </section>
        )}

        {normalizedRole !==
          "member" && (
          <section className="mt-6">
            <p className="text-xs text-zinc-500">
              TEAM MEMBERS
            </p>

            <h2 className="mt-2 text-xl font-bold">
              メンバー
            </h2>

            <div className="mt-4 space-y-3">
              {members.map(
                (member) => {
                  const memberGoal =
                    memberGoals.find(
                      (row) =>
                        row.member_id ===
                        member.id
                    );

                  const memberResult =
                    results
                      .filter(
                        (row) =>
                          row.member_id ===
                          member.id
                      )
                      .reduce(
                        (
                          sum,
                          row
                        ) => ({
                          sales:
                            sum.sales +
                            Number(
                              row.sales ??
                                0
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
                        }),
                        {
                          sales: 0,
                          champagne: 0,
                          visits: 0,
                        }
                      );

                  const memberSalesTarget =
                    Number(
                      memberGoal?.target_sales ??
                        0
                    );

                  const memberMust =
                    Number(
                      memberGoal?.must_sales ??
                        0
                    );

                  const memberChampagneTarget =
                    Number(
                      memberGoal?.champagne_target ??
                        0
                    );

                  const memberVisitTarget =
                    Number(
                      memberGoal?.visit_count_target ??
                        0
                    );

                  const memberSalesRate =
                    cappedRate(
                      memberResult.sales,
                      memberSalesTarget
                    );

                  const memberContribution =
                    salesTarget >
                    0
                      ? Math.round(
                          (memberResult.sales /
                            salesTarget) *
                            1000
                        ) /
                        10
                      : 0;

                  return (
                    <Link
                      key={
                        member.id
                      }
                      href={`/members/${member.id}`}
                      className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">
                          {
                            member.name
                          }
                        </span>

                        <span className="text-zinc-500">
                          →
                        </span>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-500">
                            売上
                          </span>

                          <span>
                            {yen(
                              memberResult.sales
                            )}
                            {" / "}
                            {memberSalesTarget >
                            0
                              ? yen(
                                  memberSalesTarget
                                )
                              : "未設定"}
                          </span>
                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full bg-white"
                            style={{
                              width: `${memberSalesRate}%`,
                            }}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                          <span>
                            {memberSalesTarget >
                            0
                              ? `個人目標達成率 ${memberSalesRate}%`
                              : "個人目標未設定"}
                          </span>

                          <span>
                            {salesTarget >
                            0
                              ? `チーム貢献率 ${memberContribution}%`
                              : "チーム目標未設定"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <TeamResultBox
                          label="個人必達"
                          value={
                            memberMust >
                            0
                              ? yen(
                                  memberMust
                                )
                              : "未設定"
                          }
                        />

                        <TeamResultBox
                          label="オリシャン"
                          value={`${
                            memberResult.champagne
                          } / ${
                            memberChampagneTarget >
                            0
                              ? `${memberChampagneTarget}本`
                              : "未設定"
                          }`}
                        />

                        <TeamResultBox
                          label="来店組数"
                          value={`${
                            memberResult.visits
                          } / ${
                            memberVisitTarget >
                            0
                              ? `${memberVisitTarget}組`
                              : "未設定"
                          }`}
                        />
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          </section>
        )}
      </div>

      {normalizedRole !==
        "member" && (
        <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-900 bg-black/95">
          <div className="mx-auto grid max-w-md grid-cols-4">
            <Link
              href="/"
              className="py-4 text-center text-xs text-zinc-600"
            >
              ホーム
            </Link>

            <Link
              href="/teams"
              className="py-4 text-center text-xs font-bold text-white"
            >
              チーム
            </Link>

            <Link
              href="/daily"
              className="py-4 text-center text-xs text-zinc-600"
            >
              日報
            </Link>

            <Link
              href="/settings"
              className="py-4 text-center text-xs text-zinc-600"
            >
              設定
            </Link>
          </div>
        </nav>
      )}
    </main>
  );
}

function TeamResultBox({
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

function GoalMiniBox({
  label,
  target,
  current,
  remaining,
}: {
  label: string;
  target: string;
  current: string;
  remaining: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {target}
      </p>

      <p className="mt-3 text-xs text-zinc-500">
        {current}
      </p>

      <p className="mt-1 text-xs text-zinc-500">
        {remaining}
      </p>
    </div>
  );
}

function AllocationRow({
  label,
  team,
  individual,
  unallocated,
}: {
  label: string;
  team: string;
  individual: string;
  unallocated: string;
}) {
  return (
    <div className="border-t border-zinc-800 pt-4 first:border-t-0 first:pt-0">
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <div className="mt-2 flex justify-between">
        <span className="text-sm">
          チーム目標
        </span>

        <span className="font-bold">
          {team}
        </span>
      </div>

      <div className="mt-2 flex justify-between">
        <span className="text-sm text-zinc-500">
          個人目標合計
        </span>

        <span>
          {individual}
        </span>
      </div>

      <div className="mt-2 flex justify-between">
        <span className="text-sm text-zinc-500">
          未配分
        </span>

        <span>
          {unallocated}
        </span>
      </div>
    </div>
  );
}