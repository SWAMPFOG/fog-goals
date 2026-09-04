"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { normalizeRole } from "@/utils/permissions";

type Member = {
  id: string;
  name: string;
  team_id: string;
};

type Goal = {
  id: string;
  target_month: string;
  must_sales: number;
  target_sales: number;
  champagne_target: number;
  visit_count_target: number;
};

function currentMonth() {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

function monthRange(targetMonth: string) {
  const startDate = `${targetMonth}-01`;

  const [year, monthNumber] = targetMonth
    .split("-")
    .map(Number);

  const next = new Date(
    year,
    monthNumber,
    1
  );

  const nextMonth = `${next.getFullYear()}-${String(
    next.getMonth() + 1
  ).padStart(2, "0")}-01`;

  return {
    startDate,
    nextMonth,
  };
}

function yen(value: number) {
  return `¥${Number(value || 0).toLocaleString(
    "ja-JP"
  )}`;
}

function percent(
  current: number,
  target: number
) {
  if (target <= 0) {
    return 0;
  }

  return (
    Math.round(
      (current / target) * 1000
    ) / 10
  );
}

function progressWidth(
  current: number,
  target: number
) {
  if (target <= 0) {
    return 0;
  }

  return Math.min(
    100,
    (current / target) * 100
  );
}

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;

  const [supabase] = useState(() =>
    createClient()
  );

  const [member, setMember] =
    useState<Member | null>(null);

  const [goal, setGoal] =
    useState<Goal | null>(null);

  const [month, setMonth] =
    useState(currentMonth());

  const [mustSales, setMustSales] =
    useState("");

  const [targetSales, setTargetSales] =
    useState("");

  const [
    champagneTarget,
    setChampagneTarget,
  ] = useState("");

  const [
    visitCountTarget,
    setVisitCountTarget,
  ] = useState("");

  const [currentSales, setCurrentSales] =
    useState(0);

  const [
    currentChampagne,
    setCurrentChampagne,
  ] = useState(0);

  const [currentVisits, setCurrentVisits] =
    useState(0);

  const [
    currentRepeatCount,
    setCurrentRepeatCount,
  ] = useState(0);

  const [
    currentFirstContactCount,
    setCurrentFirstContactCount,
  ] = useState(0);

  const [
    currentSendCount,
    setCurrentSendCount,
  ] = useState(0);

  const [
    currentInhouseCount,
    setCurrentInhouseCount,
  ] = useState(0);

  const [
    existingClientSales,
    setExistingClientSales,
  ] = useState(0);

  const [
    currentClientCount,
    setCurrentClientCount,
  ] = useState(0);

  const [
    assignedMustSales,
    setAssignedMustSales,
  ] = useState(0);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

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
    accessDenied,
    setAccessDenied,
  ] = useState(false);

  async function loadGoal(
    targetMonth: string
  ) {
    const monthDate =
      `${targetMonth}-01`;

    const {
      data,
      error,
    } = await supabase
      .from("monthly_goals")
      .select(
        "id, target_month, must_sales, target_sales, champagne_target, visit_count_target"
      )
      .eq(
        "member_id",
        memberId
      )
      .eq(
        "target_month",
        monthDate
      )
      .maybeSingle();

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    if (data) {
      setGoal(data);

      setMustSales(
        String(
          data.must_sales ?? 0
        )
      );

      setTargetSales(
        String(
          data.target_sales ?? 0
        )
      );

      setChampagneTarget(
        String(
          data.champagne_target ??
            0
        )
      );

      setVisitCountTarget(
        String(
          data.visit_count_target ??
            0
        )
      );
    } else {
      setGoal(null);
      setMustSales("");
      setTargetSales("");
      setChampagneTarget("");
      setVisitCountTarget("");
    }
  }

  async function loadDailyResults(
    targetMonth: string
  ) {
    const {
      startDate,
      nextMonth,
    } = monthRange(
      targetMonth
    );

    const {
      data,
      error,
    } = await supabase
      .from("daily_results")
      .select(
        "sales, champagne_count, visit_count, repeat_count, first_contact_count, send_count, inhouse_count"
      )
      .eq(
        "member_id",
        memberId
      )
      .gte(
        "business_date",
        startDate
      )
      .lt(
        "business_date",
        nextMonth
      );

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    const rows = data ?? [];

    setCurrentSales(
      rows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.sales ?? 0
          ),
        0
      )
    );

    setCurrentChampagne(
      rows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.champagne_count ??
              0
          ),
        0
      )
    );

    setCurrentVisits(
      rows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.visit_count ??
              0
          ),
        0
      )
    );

    setCurrentRepeatCount(
      rows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.repeat_count ??
              0
          ),
        0
      )
    );

    setCurrentFirstContactCount(
      rows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.first_contact_count ??
              0
          ),
        0
      )
    );

    setCurrentSendCount(
      rows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.send_count ??
              0
          ),
        0
      )
    );

    setCurrentInhouseCount(
      rows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.inhouse_count ??
              0
          ),
        0
      )
    );
  }

  async function loadMustProgress(
    targetMonth: string
  ) {
    const {
      startDate,
      nextMonth,
    } = monthRange(
      targetMonth
    );

    const {
      data: salesData,
      error: salesError,
    } = await supabase
      .from("client_sales")
      .select(
        "amount, client_id"
      )
      .eq(
        "member_id",
        memberId
      )
      .gte(
        "visit_date",
        startDate
      )
      .lt(
        "visit_date",
        nextMonth
      );

    if (salesError) {
      setErrorMessage(
        salesError.message
      );

      return;
    }

    const salesRows =
      salesData ?? [];

    const clientIds =
      new Set<string>();

    let clientSalesTotal = 0;

    for (
      const row of salesRows
    ) {
      if (
        !row.client_id
      ) {
        continue;
      }

      clientIds.add(
        row.client_id
      );

      clientSalesTotal +=
        Number(
          row.amount ?? 0
        );
    }

    setExistingClientSales(
      clientSalesTotal
    );

    setCurrentClientCount(
      clientIds.size
    );

    const {
      data: clientData,
      error: clientError,
    } = await supabase
      .from("clients")
      .select("id")
      .eq(
        "member_id",
        memberId
      );

    if (clientError) {
      setErrorMessage(
        clientError.message
      );

      return;
    }

    const allClientIds =
      (clientData ?? []).map(
        (client) =>
          client.id
      );

    if (
      allClientIds.length ===
      0
    ) {
      setAssignedMustSales(
        0
      );

      return;
    }

    const {
      data: targetData,
      error: targetError,
    } = await supabase
      .from(
        "client_monthly_must_targets"
      )
      .select(
        "client_id, must_sales"
      )
      .eq(
        "target_month",
        startDate
      )
      .in(
        "client_id",
        allClientIds
      );

    if (targetError) {
      setErrorMessage(
        targetError.message
      );

      return;
    }

    setAssignedMustSales(
      (targetData ?? []).reduce(
        (sum, row) =>
          sum +
          Number(
            row.must_sales ??
              0
          ),
        0
      )
    );
  }

  async function loadMonthData(
    targetMonth: string
  ) {
    setErrorMessage("");

    await Promise.all([
      loadGoal(
        targetMonth
      ),

      loadDailyResults(
        targetMonth
      ),

      loadMustProgress(
        targetMonth
      ),
    ]);
  }

  useEffect(() => {
    async function loadMember() {
      setLoading(true);
      setErrorMessage("");

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
          "role, member_id, team_id"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setErrorMessage(
          profileError.message
        );

        setLoading(false);
        return;
      }

      const currentRole =
        normalizeRole(
          profileData?.role ??
            null
        );

      const currentMemberId =
        profileData?.member_id ??
        null;

      const currentTeamId =
        profileData?.team_id ??
        null;

      setRole(
        profileData?.role ??
          null
      );

      setProfileTeamId(
        currentTeamId
      );

      const {
        data,
        error,
      } = await supabase
        .from("members")
        .select(
          "id, name, team_id"
        )
        .eq(
          "id",
          memberId
        )
        .eq(
          "is_active",
          true
        )
        .single();

      if (error) {
        setErrorMessage(
          error.message
        );

        setLoading(false);
        return;
      }

      const isAllowed =
        currentRole ===
        "member"
          ? currentMemberId ===
            memberId

          : currentRole ===
            "team_manager"
            ? currentTeamId ===
              data.team_id

            : true;

      if (!isAllowed) {
        setAccessDenied(
          true
        );

        setLoading(false);
        return;
      }

      setAccessDenied(
        false
      );

      setMember(data);

      await loadMonthData(
        month
      );

      setLoading(false);
    }

    loadMember();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    memberId,
    router,
    supabase,
  ]);

  async function changeMonth(
    value: string
  ) {
    setMonth(value);
    setMessage("");
    setEditing(false);
    setLoading(true);

    await loadMonthData(
      value
    );

    setLoading(false);
  }

  async function saveGoal() {
    if (!member) {
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    const payload = {
      member_id:
        member.id,

      team_id:
        member.team_id,

      target_month:
        `${month}-01`,

      must_sales:
        Number(
          mustSales || 0
        ),

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
          visitCountTarget ||
            0
        ),
    };

    let saveError:
      | { message: string }
      | null = null;

    if (goal?.id) {
      const result =
        await supabase
          .from(
            "monthly_goals"
          )
          .update(payload)
          .eq(
            "id",
            goal.id
          );

      saveError =
        result.error;
    } else {
      const result =
        await supabase
          .from(
            "monthly_goals"
          )
          .insert(
            payload
          );

      saveError =
        result.error;
    }

    if (saveError) {
      setErrorMessage(
        saveError.message
      );

      setSaving(false);
      return;
    }

    await loadGoal(
      month
    );

    setMessage(
      "保存しました"
    );

    setEditing(false);
    setSaving(false);
  }

  const normalizedRole =
    normalizeRole(role);

  const canEditGoal =
    normalizedRole !==
      "member" &&
    (normalizedRole !==
      "team_manager" ||
      profileTeamId ===
        member?.team_id);

  const mustSalesTarget =
    Number(
      goal?.must_sales ?? 0
    );

  const mustSalesRate =
    percent(
      existingClientSales,
      mustSalesTarget
    );

  const mustSalesRemaining =
    Math.max(
      0,
      mustSalesTarget -
        existingClientSales
    );

  const mustSalesOver =
    Math.max(
      0,
      existingClientSales -
        mustSalesTarget
    );

  const unassignedMustSales =
    Math.max(
      0,
      mustSalesTarget -
        assignedMustSales
    );

  const overAssignedMustSales =
    Math.max(
      0,
      assignedMustSales -
        mustSalesTarget
    );

  const salesTargetValue =
    Number(
      goal?.target_sales ?? 0
    );

  const salesRate =
    percent(
      currentSales,
      salesTargetValue
    );

  const salesRemaining =
    Math.max(
      0,
      salesTargetValue -
        currentSales
    );

  const champagneTargetValue =
    Number(
      goal?.champagne_target ??
        0
    );

  const champagneRemaining =
    Math.max(
      0,
      champagneTargetValue -
        currentChampagne
    );

  const visitTargetValue =
    Number(
      goal?.visit_count_target ??
        0
    );

  const visitRemaining =
    Math.max(
      0,
      visitTargetValue -
        currentVisits
    );

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-md">
          <Link
            href="/"
            className="text-sm text-zinc-500"
          >
            ← ホーム
          </Link>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-lg font-bold">
              閲覧権限がありません
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              このアカウントでは、このメンバーの情報を閲覧できません。
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black pb-24 text-white">
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
            href="/members"
            className="text-sm text-zinc-500"
          >
            ← メンバー一覧
          </Link>
        )}

        {loading ? (
          <p className="mt-8 text-zinc-500">
            読み込み中...
          </p>
        ) : errorMessage ? (
          <p className="mt-8 rounded-2xl border border-red-900 p-4 text-sm text-red-400">
            ERROR:{" "}
            {errorMessage}
          </p>
        ) : member ? (
          <>
            <header className="mt-6 mb-7">
              <p className="text-xs tracking-[0.3em] text-zinc-500">
                SWAMP-FOG
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                {member.name}
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                PERSONAL GOALS
              </p>

              {normalizedRole !==
                "member" && (
                <Link
                  href={`/teams/${member.team_id}`}
                  className="mt-3 inline-block text-sm text-zinc-500"
                >
                  ← 所属チームへ戻る
                </Link>
              )}
            </header>

            <div className="mb-4 flex items-center justify-between gap-3">
              <input
                type="month"
                value={month}
                onChange={(e) =>
                  changeMonth(
                    e.target.value
                  )
                }
                className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
              />

              {canEditGoal ? (
                <button
                  onClick={() => {
                    setEditing(
                      !editing
                    );

                    setMessage(
                      ""
                    );
                  }}
                  className="shrink-0 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold"
                >
                  {editing
                    ? "閉じる"
                    : goal
                      ? "目標を変更"
                      : "目標を設定"}
                </button>
              ) : (
                <span className="text-xs text-zinc-600">
                  閲覧のみ
                </span>
              )}
            </div>

            {editing &&
              canEditGoal && (
                <section className="mb-4 rounded-3xl border border-zinc-700 bg-zinc-950 p-5">
                  <p className="text-lg font-bold">
                    目標設定
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {month.replace(
                      "-",
                      "年"
                    )}
                    月
                  </p>

                  <div className="mt-5 space-y-4">
                    <label className="block">
                      <span className="text-xs text-zinc-500">
                        個人必達
                      </span>

                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={
                          mustSales
                        }
                        onChange={(e) =>
                          setMustSales(
                            e.target.value
                          )
                        }
                        placeholder="1000000"
                        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-zinc-500">
                        月間売上目標
                      </span>

                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={
                          targetSales
                        }
                        onChange={(e) =>
                          setTargetSales(
                            e.target.value
                          )
                        }
                        placeholder="5000000"
                        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-zinc-500">
                        オリシャン目標
                      </span>

                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={
                          champagneTarget
                        }
                        onChange={(e) =>
                          setChampagneTarget(
                            e.target.value
                          )
                        }
                        placeholder="10"
                        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-zinc-500">
                        来店組数目標
                      </span>

                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={
                          visitCountTarget
                        }
                        onChange={(e) =>
                          setVisitCountTarget(
                            e.target.value
                          )
                        }
                        placeholder="30"
                        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none"
                      />
                    </label>
                  </div>

                  <button
                    onClick={
                      saveGoal
                    }
                    disabled={
                      saving
                    }
                    className="mt-6 w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
                  >
                    {saving
                      ? "保存中..."
                      : "保存する"}
                  </button>
                </section>
              )}

            {message && (
              <p className="mb-4 text-center text-sm text-green-400">
                {message}
              </p>
            )}

            <section className="rounded-3xl border border-zinc-700 bg-zinc-950 p-5">
              <p className="text-xs text-zinc-500">
                MUST SALES
              </p>

              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-400">
                    個人必達
                  </p>

                  <p className="mt-1 text-3xl font-bold">
                    {mustSalesTarget >
                    0
                      ? yen(
                          mustSalesTarget
                        )
                      : "未設定"}
                  </p>
                </div>

                <p className="text-right text-2xl font-bold">
                  {mustSalesTarget >
                  0
                    ? `${mustSalesRate}%`
                    : "－"}
                </p>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-white"
                  style={{
                    width: `${progressWidth(
                      existingClientSales,
                      mustSalesTarget
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <ResultBox
                  label="既存顧客売上"
                  value={yen(
                    existingClientSales
                  )}
                />

                <ResultBox
                  label={
                    mustSalesTarget >
                      0 &&
                    mustSalesOver >
                      0
                      ? "必達超過"
                      : "残り"
                  }
                  value={
                    mustSalesTarget <=
                    0
                      ? "－"
                      : mustSalesOver >
                          0
                        ? `+${yen(
                            mustSalesOver
                          )}`
                        : yen(
                            mustSalesRemaining
                          )
                  }
                />
              </div>

              <div className="mt-5 border-t border-zinc-800 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">
                    クライアント別配分
                  </span>

                  <span className="font-bold">
                    {yen(
                      assignedMustSales
                    )}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-zinc-500">
                    {overAssignedMustSales >
                    0
                      ? "配分超過"
                      : "未配分"}
                  </span>

                  <span>
                    {mustSalesTarget >
                    0
                      ? overAssignedMustSales >
                        0
                        ? `+${yen(
                            overAssignedMustSales
                          )}`
                        : yen(
                            unassignedMustSales
                          )
                      : "－"}
                  </span>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs text-zinc-500">
                月間売上目標
              </p>

              <p className="mt-2 text-3xl font-bold">
                {salesTargetValue >
                0
                  ? yen(
                      salesTargetValue
                    )
                  : "未設定"}
              </p>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-white"
                  style={{
                    width: `${progressWidth(
                      currentSales,
                      salesTargetValue
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-3 flex justify-between text-xs text-zinc-500">
                <span>
                  現在{" "}
                  {yen(
                    currentSales
                  )}
                </span>

                <span>
                  達成率{" "}
                  {salesTargetValue >
                  0
                    ? `${salesRate}%`
                    : "－"}
                </span>
              </div>

              <p className="mt-4 text-sm text-zinc-400">
                残り{" "}
                {salesTargetValue >
                0
                  ? yen(
                      salesRemaining
                    )
                  : "－"}
              </p>
            </section>

            <section className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-xs text-zinc-500">
                  オリシャン目標
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {champagneTargetValue >
                  0
                    ? `${champagneTargetValue}本`
                    : "未設定"}
                </p>

                <p className="mt-3 text-xs text-zinc-500">
                  現在{" "}
                  {currentChampagne}
                  本
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  残り{" "}
                  {champagneTargetValue >
                  0
                    ? champagneRemaining
                    : "－"}
                  本
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-xs text-zinc-500">
                  来店組数目標
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {visitTargetValue >
                  0
                    ? `${visitTargetValue}組`
                    : "未設定"}
                </p>

                <p className="mt-3 text-xs text-zinc-500">
                  現在{" "}
                  {currentVisits}
                  組
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  残り{" "}
                  {visitTargetValue >
                  0
                    ? visitRemaining
                    : "－"}
                  組
                </p>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs text-zinc-500">
                MONTHLY RESULT
              </p>

              <h2 className="mt-2 text-xl font-bold">
                月間営業実績
              </h2>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <ResultBox
                  label="来店組数"
                  value={`${currentVisits}組`}
                />

                <ResultBox
                  label="顧客数"
                  value={`${currentClientCount}人`}
                />

                <ResultBox
                  label="リピート"
                  value={`${currentRepeatCount}組`}
                />

                <ResultBox
                  label="初回"
                  value={`${currentFirstContactCount}組`}
                />

                <ResultBox
                  label="送り"
                  value={`${currentSendCount}件`}
                />

                <ResultBox
                  label="場内"
                  value={`${currentInhouseCount}件`}
                />
              </div>
            </section>
          </>
        ) : null}
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
              href="/members"
              className="py-4 text-center text-xs font-bold text-white"
            >
              メンバー
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