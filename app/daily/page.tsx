"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { normalizeRole } from "@/utils/permissions";

type Member = {
  id: string;
  team_id: string | null;
  name: string;
  display_order: number | null;
};

type DailyInput = {
  member_id: string;
  team_id: string | null;
  sales: string;
  champagne_count: string;
  visit_count: string;
  repeat_count: string;
  first_contact_count: string;
  send_count: string;
  inhouse_count: string;
  note: string;
};

type DailyDbRow = {
  member_id: string;
  team_id: string | null;
  business_date: string;
  sales: number | null;
  champagne_count: number | null;
  visit_count: number | null;
  repeat_count: number | null;
  first_contact_count: number | null;
  send_count: number | null;
  inhouse_count: number | null;
  note: string | null;
};

type Totals = {
  sales: number;
  champagne_count: number;
  visit_count: number;
  repeat_count: number;
  first_contact_count: number;
  send_count: number;
  inhouse_count: number;
};

const ZERO_TOTALS: Totals = {
  sales: 0,
  champagne_count: 0,
  visit_count: 0,
  repeat_count: 0,
  first_contact_count: 0,
  send_count: 0,
  inhouse_count: 0,
};

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function emptyRow(member: Member): DailyInput {
  return {
    member_id: member.id,
    team_id: member.team_id,
    sales: "",
    champagne_count: "",
    visit_count: "",
    repeat_count: "",
    first_contact_count: "",
    send_count: "",
    inhouse_count: "",
    note: "",
  };
}

function directRow(member: Member, item: DailyDbRow): DailyInput {
  return {
    member_id: member.id,
    team_id: item.team_id ?? member.team_id,
    sales: String(Number(item.sales ?? 0)),
    champagne_count: String(Number(item.champagne_count ?? 0)),
    visit_count: String(Number(item.visit_count ?? 0)),
    repeat_count: String(Number(item.repeat_count ?? 0)),
    first_contact_count: String(Number(item.first_contact_count ?? 0)),
    send_count: String(Number(item.send_count ?? 0)),
    inhouse_count: String(Number(item.inhouse_count ?? 0)),
    note: item.note ?? "",
  };
}

function cumulativeRow(member: Member, totals: Totals): DailyInput {
  const show = (value: number) => (value === 0 ? "" : String(value));

  return {
    member_id: member.id,
    team_id: member.team_id,
    sales: show(totals.sales),
    champagne_count: show(totals.champagne_count),
    visit_count: show(totals.visit_count),
    repeat_count: show(totals.repeat_count),
    first_contact_count: show(totals.first_contact_count),
    send_count: show(totals.send_count),
    inhouse_count: show(totals.inhouse_count),
    note: "",
  };
}

function addToTotals(target: Totals, item: DailyDbRow) {
  target.sales += Number(item.sales ?? 0);
  target.champagne_count += Number(item.champagne_count ?? 0);
  target.visit_count += Number(item.visit_count ?? 0);
  target.repeat_count += Number(item.repeat_count ?? 0);
  target.first_contact_count += Number(item.first_contact_count ?? 0);
  target.send_count += Number(item.send_count ?? 0);
  target.inhouse_count += Number(item.inhouse_count ?? 0);
}

function hasInput(row: DailyInput) {
  return (
    row.sales !== "" ||
    row.champagne_count !== "" ||
    row.visit_count !== "" ||
    row.repeat_count !== "" ||
    row.first_contact_count !== "" ||
    row.send_count !== "" ||
    row.inhouse_count !== "" ||
    row.note.trim() !== ""
  );
}

function numberOf(value: string) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export default function DailyPage() {
  const [supabase] = useState(() => createClient());
  const [businessDate, setBusinessDate] = useState(todayJst());
  const [members, setMembers] = useState<Member[]>([]);
  const [rows, setRows] = useState<Record<string, DailyInput>>({});
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const normalizedRole = normalizeRole(role);
  const canEdit = normalizedRole !== "member";

  useEffect(() => {
    async function loadBase() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, team_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setMessage("ERROR: " + profileError.message);
        setLoading(false);
        return;
      }

      const currentRole = normalizeRole(profile?.role ?? null);
      const currentTeamId = profile?.team_id ?? null;
      const requestedTeamId = new URLSearchParams(window.location.search).get(
        "team"
      );

      setRole(profile?.role ?? "");

      if (currentRole === "member") {
        setMembers([]);
        setRows({});
        setLoading(false);
        return;
      }

      let memberQuery = supabase
        .from("members")
        .select("id, team_id, name, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (currentRole === "team_manager") {
        if (!currentTeamId) {
          setMembers([]);
          setRows({});
          setMessage("ERROR: 所属チームが未設定です");
          setLoading(false);
          return;
        }

        if (requestedTeamId && requestedTeamId !== currentTeamId) {
          setMembers([]);
          setRows({});
          setMessage("ERROR: 他チームの日報は編集できません");
          setLoading(false);
          return;
        }

        memberQuery = memberQuery.eq("team_id", currentTeamId);
      } else if (requestedTeamId) {
        memberQuery = memberQuery.eq("team_id", requestedTeamId);
      }

      const { data, error } = await memberQuery;

      if (error) {
        setMessage("ERROR: " + error.message);
        setLoading(false);
        return;
      }

      const memberList = (data ?? []) as Member[];
      const initial: Record<string, DailyInput> = {};

      memberList.forEach((member) => {
        initial[member.id] = emptyRow(member);
      });

      setMembers(memberList);
      setRows(initial);
      setLoading(false);
    }

    loadBase();
  }, [supabase]);

  useEffect(() => {
    if (members.length === 0 || !businessDate) return;

    async function loadDaily() {
      setDailyLoading(true);

      const ids = members.map((member) => member.id);
      const monthStart = `${businessDate.slice(0, 7)}-01`;

      const { data, error } = await supabase
        .from("daily_results")
        .select(
          `
          member_id,
          team_id,
          business_date,
          sales,
          champagne_count,
          visit_count,
          repeat_count,
          first_contact_count,
          send_count,
          inhouse_count,
          note
        `
        )
        .gte("business_date", monthStart)
        .lte("business_date", businessDate)
        .in("member_id", ids);

      if (error) {
        setMessage("ERROR: " + error.message);
        setDailyLoading(false);
        return;
      }

      const loaded = (data ?? []) as DailyDbRow[];
      const previousByMember: Record<string, Totals> = {};
      const currentDayByMember: Record<string, DailyDbRow> = {};
      const existing = new Set<string>();

      for (const item of loaded) {
        if (item.business_date === businessDate) {
          currentDayByMember[item.member_id] = item;
          existing.add(item.member_id);
          continue;
        }

        if (!previousByMember[item.member_id]) {
          previousByMember[item.member_id] = { ...ZERO_TOTALS };
        }

        addToTotals(previousByMember[item.member_id], item);
      }

      const nextRows: Record<string, DailyInput> = {};

      for (const member of members) {
        const currentDay = currentDayByMember[member.id];

        if (currentDay) {
          nextRows[member.id] = directRow(member, currentDay);
        } else {
          nextRows[member.id] = cumulativeRow(
            member,
            previousByMember[member.id] ?? ZERO_TOTALS
          );
        }
      }

      setRows(nextRows);
      setExistingIds(existing);
      setDailyLoading(false);
    }

    loadDaily();
  }, [businessDate, members, reloadKey, supabase]);

  function change(
    memberId: string,
    field: keyof DailyInput,
    value: string
  ) {
    setRows((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: value,
      },
    }));
  }

  async function resetCurrentDay() {
    if (!canEdit) return;

    const ok = window.confirm(
      `${businessDate} の日報データを削除します。\n本当に削除しますか？`
    );

    if (!ok) return;

    setSaving(true);
    setMessage("");

    const ids = members.map((member) => member.id);

    const { error } = await supabase
      .from("daily_results")
      .delete()
      .eq("business_date", businessDate)
      .in("member_id", ids);

    if (error) {
      setMessage("ERROR: " + error.message);
      setSaving(false);
      return;
    }

    setMessage(`${businessDate} のデータを削除しました`);
    setReloadKey((value) => value + 1);
    setSaving(false);
  }

  async function resetCurrentMonth() {
    if (!canEdit) return;

    const yearMonth = businessDate.slice(0, 7);
    const startDate = `${yearMonth}-01`;
    const [year, month] = yearMonth.split("-").map(Number);
    const nextMonthDate = new Date(year, month, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(
      nextMonthDate.getMonth() + 1
    ).padStart(2, "0")}-01`;

    const ok = window.confirm(
      `${yearMonth} の表示対象メンバーの実績を全削除します。\n本当に削除しますか？`
    );

    if (!ok) return;

    const finalOk = window.confirm(
      "最終確認です。\nこの操作は元に戻せません。削除しますか？"
    );

    if (!finalOk) return;

    setSaving(true);
    setMessage("");

    const ids = members.map((member) => member.id);

    const { error } = await supabase
      .from("daily_results")
      .delete()
      .gte("business_date", startDate)
      .lt("business_date", nextMonth)
      .in("member_id", ids);

    if (error) {
      setMessage("ERROR: " + error.message);
      setSaving(false);
      return;
    }

    setMessage(`${yearMonth} の実績をリセットしました`);
    setReloadKey((value) => value + 1);
    setSaving(false);
  }

  async function saveAll() {
    if (!canEdit || dailyLoading) return;

    const targets = members
      .map((member) => rows[member.id])
      .filter(
        (row): row is DailyInput =>
          !!row && (hasInput(row) || existingIds.has(row.member_id))
      );

    if (targets.length === 0) {
      setMessage("入力された日報がありません");
      return;
    }

    for (const row of targets) {
      const values = [
        row.sales,
        row.champagne_count,
        row.visit_count,
        row.repeat_count,
        row.first_contact_count,
        row.send_count,
        row.inhouse_count,
      ].map(numberOf);

      if (values.some((value) => value < 0)) {
        const memberName = members.find((m) => m.id === row.member_id)?.name;
        setMessage(
          `ERROR: ${
            memberName ?? "対象メンバー"
          } の数字は0以上で入力してください`
        );
        return;
      }
    }

    setSaving(true);
    setMessage("");

    const monthStart = `${businessDate.slice(0, 7)}-01`;
    const targetIds = targets.map((row) => row.member_id);

    const { data: previousData, error: previousError } = await supabase
      .from("daily_results")
      .select(
        `
        member_id,
        team_id,
        business_date,
        sales,
        champagne_count,
        visit_count,
        repeat_count,
        first_contact_count,
        send_count,
        inhouse_count,
        note
      `
      )
      .gte("business_date", monthStart)
      .lt("business_date", businessDate)
      .in("member_id", targetIds);

    if (previousError) {
      setMessage("ERROR: " + previousError.message);
      setSaving(false);
      return;
    }

    const previousByMember: Record<string, Totals> = {};

    for (const item of (previousData ?? []) as DailyDbRow[]) {
      if (!previousByMember[item.member_id]) {
        previousByMember[item.member_id] = { ...ZERO_TOTALS };
      }
      addToTotals(previousByMember[item.member_id], item);
    }

    const payload: Array<{
      member_id: string;
      team_id: string | null;
      business_date: string;
      sales: number;
      champagne_count: number;
      visit_count: number;
      existing_visit_count: number;
      repeat_count: number;
      first_contact_count: number;
      send_count: number;
      inhouse_count: number;
      note: string | null;
    }> = [];

    for (const row of targets) {
      const isEditingExistingDay = existingIds.has(row.member_id);
      const previous = previousByMember[row.member_id] ?? ZERO_TOTALS;

      let sales = numberOf(row.sales);
      let champagneCount = numberOf(row.champagne_count);
      let visitCount = numberOf(row.visit_count);
      let repeatCount = numberOf(row.repeat_count);
      let firstContactCount = numberOf(row.first_contact_count);
      let sendCount = numberOf(row.send_count);
      let inhouseCount = numberOf(row.inhouse_count);

      if (!isEditingExistingDay) {
        const currentCumulative: Totals = {
          sales,
          champagne_count: champagneCount,
          visit_count: visitCount,
          repeat_count: repeatCount,
          first_contact_count: firstContactCount,
          send_count: sendCount,
          inhouse_count: inhouseCount,
        };

        const fieldChecks: Array<[keyof Totals, string]> = [
          ["sales", "売上"],
          ["champagne_count", "オリシャン"],
          ["visit_count", "来店組数"],
          ["repeat_count", "リピート"],
          ["first_contact_count", "初回"],
          ["send_count", "送り"],
          ["inhouse_count", "場内"],
        ];

        const invalidField = fieldChecks.find(
          ([key]) => currentCumulative[key] < previous[key]
        );

        if (invalidField) {
          const memberName = members.find((m) => m.id === row.member_id)?.name;
          setMessage(
            `ERROR: ${
              memberName ?? "対象メンバー"
            } の${
              invalidField[1]
            }が前日までの累計より小さくなっています。過去の数字を減らす場合は、その営業日を選んで直接修正してください。`
          );
          setSaving(false);
          return;
        }

        sales -= previous.sales;
        champagneCount -= previous.champagne_count;
        visitCount -= previous.visit_count;
        repeatCount -= previous.repeat_count;
        firstContactCount -= previous.first_contact_count;
        sendCount -= previous.send_count;
        inhouseCount -= previous.inhouse_count;
      }

      payload.push({
        member_id: row.member_id,
        team_id: row.team_id,
        business_date: businessDate,
        sales,
        champagne_count: champagneCount,
        visit_count: visitCount,
        existing_visit_count: Math.max(0, visitCount - repeatCount),
        repeat_count: repeatCount,
        first_contact_count: firstContactCount,
        send_count: sendCount,
        inhouse_count: inhouseCount,
        note: row.note.trim() || null,
      });
    }

    const { error } = await supabase.from("daily_results").upsert(payload, {
      onConflict: "member_id,business_date",
    });

    if (error) {
      setMessage("ERROR: " + error.message);
      setSaving(false);
      return;
    }

    const payloadByMember = new Map(
      payload.map((item) => [item.member_id, item] as const)
    );

    setRows((prev) => {
      const next = { ...prev };

      for (const member of members) {
        const item = payloadByMember.get(member.id);
        if (!item) continue;

        next[member.id] = {
          member_id: member.id,
          team_id: item.team_id,
          sales: String(item.sales),
          champagne_count: String(item.champagne_count),
          visit_count: String(item.visit_count),
          repeat_count: String(item.repeat_count),
          first_contact_count: String(item.first_contact_count),
          send_count: String(item.send_count),
          inhouse_count: String(item.inhouse_count),
          note: item.note ?? "",
        };
      }

      return next;
    });

    setExistingIds((prev) => {
      const next = new Set(prev);
      targets.forEach((row) => next.add(row.member_id));
      return next;
    });

    setMessage(`${targets.length}名分の日報を保存しました`);
    setSaving(false);

    const returnTeamId = new URLSearchParams(window.location.search).get("team");
    if (returnTeamId) {
      window.location.href = `/teams/${returnTeamId}`;
    }
  }

  const completedCount = useMemo(
    () => members.filter((member) => existingIds.has(member.id)).length,
    [members, existingIds]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        読み込み中...
      </main>
    );
  }

  if (!canEdit) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-md px-4">
          <p className="text-xs tracking-[0.3em] text-zinc-500">SWAMP-FOG</p>
          <h1 className="mt-2 text-3xl font-bold">日報</h1>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="font-bold">日報は部責以上が入力します</p>
            <p className="mt-2 text-sm text-zinc-500">
              キャストアカウントからの日報入力はできません。
            </p>

            <Link
              href="/"
              className="mt-5 block rounded-xl border border-zinc-700 py-3 text-center text-sm font-bold"
            >
              ホームへ戻る
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black pb-28 text-white">
      <div className="mx-auto w-full max-w-3xl px-4 pt-8">
        <p className="text-xs tracking-[0.3em] text-zinc-500">SWAMP-FOG</p>
        <h1 className="mt-2 text-3xl font-bold">日報入力・編集</h1>
        <p className="mt-1 text-sm text-zinc-500">DAILY RESULT</p>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
          <p className="text-sm font-bold">入力ルール</p>
          <p className="mt-2 text-xs leading-5 text-zinc-400">
            未入力の人は月間累計を入力します。「済」の人は、その営業日の実績を直接編集します。
            入力済みの日報は数字を減らして保存できます。
          </p>
        </section>

        <section className="mt-5 rounded-2xl border border-zinc-800 p-4">
          <label className="block">
            <span className="text-sm text-zinc-400">営業日</span>
            <input
              type="date"
              value={businessDate}
              onChange={(e) => {
                setMessage("");
                setBusinessDate(e.target.value);
              }}
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white"
            />
          </label>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-zinc-400">入力状況</span>
            <span className="font-bold">
              {completedCount} / {members.length}名
            </span>
          </div>

          {dailyLoading && (
            <p className="mt-3 text-xs text-zinc-500">日報を読み込み中...</p>
          )}
        </section>

        <div className="mt-5 space-y-4">
          {[...members]
            .sort((a, b) => {
              const aDone = existingIds.has(a.id);
              const bDone = existingIds.has(b.id);
              if (aDone && !bDone) return -1;
              if (!aDone && bDone) return 1;
              return (a.display_order ?? 9999) - (b.display_order ?? 9999);
            })
            .map((member) => {
              const row = rows[member.id];
              if (!row) return null;

              const completed = existingIds.has(member.id);
              const existingVisits = Math.max(
                0,
                numberOf(row.visit_count) - numberOf(row.repeat_count)
              );

              return (
                <section
                  key={member.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold">{member.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {completed
                          ? "入力済み｜この日の実績を直接編集"
                          : "未入力｜月間累計を入力"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                        completed
                          ? "border-zinc-600 text-white"
                          : "border-zinc-800 text-zinc-500"
                      }`}
                    >
                      {completed ? "済" : "未"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="売上"
                      value={row.sales}
                      disabled={!canEdit || dailyLoading}
                      onChange={(value) => change(member.id, "sales", value)}
                    />

                    <Field
                      label="オリシャン"
                      value={row.champagne_count}
                      disabled={!canEdit || dailyLoading}
                      onChange={(value) =>
                        change(member.id, "champagne_count", value)
                      }
                    />

                    <Field
                      label="来店組数"
                      value={row.visit_count}
                      disabled={!canEdit || dailyLoading}
                      onChange={(value) =>
                        change(member.id, "visit_count", value)
                      }
                    />

                    <div className="block">
                      <span className="text-xs text-zinc-500">既存来店</span>
                      <div className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-white">
                        {existingVisits}
                      </div>
                    </div>

                    <Field
                      label="リピート"
                      value={row.repeat_count}
                      disabled={!canEdit || dailyLoading}
                      onChange={(value) =>
                        change(member.id, "repeat_count", value)
                      }
                    />

                    <details className="col-span-2 rounded-xl border border-zinc-800 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-bold text-zinc-300">
                        営業行動の詳細
                      </summary>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Field
                          label="初回"
                          value={row.first_contact_count}
                          disabled={!canEdit || dailyLoading}
                          onChange={(value) =>
                            change(member.id, "first_contact_count", value)
                          }
                        />

                        <Field
                          label="送り"
                          value={row.send_count}
                          disabled={!canEdit || dailyLoading}
                          onChange={(value) =>
                            change(member.id, "send_count", value)
                          }
                        />

                        <Field
                          label="場内"
                          value={row.inhouse_count}
                          disabled={!canEdit || dailyLoading}
                          onChange={(value) =>
                            change(member.id, "inhouse_count", value)
                          }
                        />
                      </div>
                    </details>
                  </div>

                  <label className="mt-3 block">
                    <span className="text-xs text-zinc-500">メモ</span>
                    <textarea
                      value={row.note}
                      disabled={!canEdit || dailyLoading}
                      onChange={(e) => change(member.id, "note", e.target.value)}
                      rows={1}
                      className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2.5 text-sm text-white disabled:opacity-60"
                      placeholder="必要な場合のみ入力"
                    />
                  </label>
                </section>
              );
            })}
        </div>

        {canEdit && (
          <>
            <details className="mt-6 rounded-2xl border border-red-950 bg-red-950/10 p-4">
              <summary className="cursor-pointer text-sm font-bold text-red-400">
                データ管理
              </summary>

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={resetCurrentDay}
                  disabled={saving || dailyLoading}
                  className="w-full rounded-xl border border-red-900 py-3 text-sm font-bold text-red-400 disabled:opacity-40"
                >
                  この日のデータを削除
                </button>

                <button
                  type="button"
                  onClick={resetCurrentMonth}
                  disabled={saving || dailyLoading}
                  className="w-full rounded-xl bg-red-950 py-3 text-sm font-bold text-red-300 disabled:opacity-40"
                >
                  今月の対象データを全リセット
                </button>
              </div>
            </details>

            <div className="sticky bottom-16 z-40 mt-6 bg-black/95 py-3">
              <button
                type="button"
                onClick={saveAll}
                disabled={saving || dailyLoading}
                className="w-full rounded-2xl bg-white py-4 font-bold text-black shadow-lg disabled:opacity-50"
              >
                {saving ? "保存中..." : "入力した日報を一括保存"}
              </button>
            </div>
          </>
        )}

        {message && <p className="mt-4 text-center text-sm">{message}</p>}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 pt-1">
          <NavItem href="/" icon="⌂" label="ホーム" />
          <NavItem href="/members" icon="♙" label="メンバー" />
          <NavItem href="/daily" icon="✎" label="日報" active />
          <NavItem href="/settings" icon="⚙" label="設定" />
        </div>
      </nav>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-500">{label}</span>

      <input
        type="number"
        inputMode="numeric"
        min="0"
        step="1"
        value={value}
        disabled={disabled}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2.5 text-white disabled:opacity-60"
      />
    </label>
  );
}

function NavItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`py-2.5 text-center text-[10px] ${
        active ? "font-bold text-white" : "text-zinc-600"
      }`}
    >
      <span className="block text-lg leading-none">{icon}</span>
      <span className="mt-1 block">{label}</span>
    </Link>
  );
}
