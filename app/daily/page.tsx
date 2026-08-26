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
  existing_visit_count: string;
  repeat_count: string;
  first_contact_count: string;
  send_count: string;
  inhouse_count: string;
  contact_acquired_count: string;
  repeat_plan_count: string;
  note: string;
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
    existing_visit_count: "",
    repeat_count: "",
    first_contact_count: "",
    send_count: "",
    inhouse_count: "",
    contact_acquired_count: "",
    repeat_plan_count: "",
    note: "",
  };
}

export default function DailyPage() {
  const [supabase] = useState(() => createClient());

  const [businessDate, setBusinessDate] = useState(todayJst());
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamOptions, setTeamOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [rows, setRows] = useState<Record<string, DailyInput>>({});
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());

  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
      const requestedTeamId =
        new URLSearchParams(window.location.search).get("team");

      setRole(profile?.role ?? "");
      let currentDepartmentId: string | null = null;

      if (currentTeamId) {
        const { data: ownTeam, error: ownTeamError } = await supabase
          .from("teams")
          .select("department_id")
          .eq("id", currentTeamId)
          .maybeSingle();

        if (ownTeamError) {
          setMessage("ERROR: " + ownTeamError.message);
          setLoading(false);
          return;
        }

        currentDepartmentId = ownTeam?.department_id ?? null;
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

        memberQuery = memberQuery.eq("team_id", currentTeamId);
      } else if (currentRole === "member") {
        setMembers([]);
        setRows({});
        setLoading(false);
        return;
      }

      if (requestedTeamId) {
        if (
          currentRole === "team_manager" &&
          requestedTeamId !== currentTeamId
        ) {
          setMembers([]);
          setRows({});
          setMessage("ERROR: 他チームの日報は編集できません");
          setLoading(false);
          return;
        }

        memberQuery = memberQuery.eq("team_id", requestedTeamId);
      }

      const { data, error } = await memberQuery;

      if (error) {
        setMessage("ERROR: " + error.message);
        setLoading(false);
        return;
      }

      const memberList = (data ?? []) as Member[];
      setMembers(memberList);

      const initial: Record<string, DailyInput> = {};

      memberList.forEach((member) => {
        initial[member.id] = emptyRow(member);
      });

      setRows(initial);
      setLoading(false);
    }

    loadBase();
  }, [supabase]);

  useEffect(() => {
    if (members.length === 0 || !businessDate) return;

    async function loadDaily() {
      setMessage("");

      const ids = members.map((m) => m.id);
      const monthStart = `${businessDate.slice(0, 7)}-01`;

      const { data, error } = await supabase
        .from("daily_results")
        .select(`
          member_id,
          team_id,
          business_date,
          sales,
          champagne_count,
          visit_count,
          existing_visit_count,
          repeat_count,
          first_contact_count,
          send_count,
          inhouse_count,
          contact_acquired_count,
          repeat_plan_count,
          note
        `)
        .gte("business_date", monthStart)
        .lte("business_date", businessDate)
        .in("member_id", ids);

      if (error) {
        setMessage("ERROR: " + error.message);
        return;
      }

      const loaded = data ?? [];
      const existing = new Set<string>();

      const next: Record<string, DailyInput> = {};

      members.forEach((member) => {
        next[member.id] = emptyRow(member);
      });

      loaded.forEach((item: any) => {
        const id = item.member_id;

        if (item.business_date === businessDate) {
          existing.add(id);
        }

        const row = next[id] ?? emptyRow(
          members.find((m) => m.id === id)!
        );

        row.team_id = item.team_id ?? row.team_id;

        row.sales = String(
          Number(row.sales || 0) + Number(item.sales ?? 0)
        );
        row.champagne_count = String(
          Number(row.champagne_count || 0) +
          Number(item.champagne_count ?? 0)
        );
        row.visit_count = String(
          Number(row.visit_count || 0) +
          Number(item.visit_count ?? 0)
        );
        row.existing_visit_count = String(
          Number(row.existing_visit_count || 0) +
          Number(item.existing_visit_count ?? 0)
        );
        row.repeat_count = String(
          Number(row.repeat_count || 0) +
          Number(item.repeat_count ?? 0)
        );
        row.first_contact_count = String(
          Number(row.first_contact_count || 0) +
          Number(item.first_contact_count ?? 0)
        );
        row.send_count = String(
          Number(row.send_count || 0) +
          Number(item.send_count ?? 0)
        );
        row.inhouse_count = String(
          Number(row.inhouse_count || 0) +
          Number(item.inhouse_count ?? 0)
        );
        row.contact_acquired_count = String(
          Number(row.contact_acquired_count || 0) +
          Number(item.contact_acquired_count ?? 0)
        );
        row.repeat_plan_count = String(
          Number(row.repeat_plan_count || 0) +
          Number(item.repeat_plan_count ?? 0)
        );

        if (item.business_date === businessDate) {
          row.note = item.note ?? "";
        }

        next[id] = row;
      });

      setRows(next);
      setExistingIds(existing);
    }

    loadDaily();
  }, [businessDate, members, supabase]);

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

  function hasInput(row: DailyInput) {
    return (
      row.sales !== "" ||
      row.champagne_count !== "" ||
      row.visit_count !== "" ||
      row.existing_visit_count !== "" ||
      row.repeat_count !== "" ||
      row.first_contact_count !== "" ||
      row.send_count !== "" ||
      row.inhouse_count !== "" ||
      row.contact_acquired_count !== "" ||
      row.repeat_plan_count !== "" ||
      row.note.trim() !== ""
    );
  }


  async function resetCurrentDay() {
    if (!canEdit) return;

    const ok = window.confirm(
      `${businessDate} の日報データを削除します。\n本当に削除しますか？`
    );
    if (!ok) return;

    setSaving(true);
    setMessage("");

    const ids = members.map((m) => m.id);

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

    const next: Record<string, DailyInput> = {};
    members.forEach((member) => {
      next[member.id] = emptyRow(member);
    });

    setRows(next);
    setExistingIds(new Set());
    setMessage(`${businessDate} のデータを削除しました`);
    setSaving(false);
  }

  async function resetCurrentMonth() {
    if (!canEdit) return;

    const yearMonth = businessDate.slice(0, 7);
    const startDate = `${yearMonth}-01`;

    const [year, month] = yearMonth.split("-").map(Number);
    const next = new Date(year, month, 1);

    const nextMonth =
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;

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

    const ids = members.map((m) => m.id);

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

    const nextRows: Record<string, DailyInput> = {};
    members.forEach((member) => {
      nextRows[member.id] = emptyRow(member);
    });

    setRows(nextRows);
    setExistingIds(new Set());
    setMessage(`${yearMonth} の実績をリセットしました`);
    setSaving(false);
  }

  async function saveAll() {
    if (!canEdit) return;

    const targets = members
      .map((member) => rows[member.id])
      .filter(
        (row) =>
          row &&
          (hasInput(row) || existingIds.has(row.member_id))
      );

    if (targets.length === 0) {
      setMessage("入力された日報がありません");
      return;
    }

    setSaving(true);
    setMessage("");

    const monthStart = `${businessDate.slice(0, 7)}-01`;
    const targetIds = targets.map((row) => row.member_id);

    const { data: previousData, error: previousError } = await supabase
      .from("daily_results")
      .select(`
        member_id,
        sales,
        champagne_count,
        visit_count,
        existing_visit_count,
        repeat_count,
        first_contact_count,
        send_count,
        inhouse_count,
        contact_acquired_count,
        repeat_plan_count
      `)
      .gte("business_date", monthStart)
      .lt("business_date", businessDate)
      .in("member_id", targetIds);

    if (previousError) {
      setMessage("ERROR: " + previousError.message);
      setSaving(false);
      return;
    }

    const previous: Record<string, {
      sales: number;
      champagne_count: number;
      visit_count: number;
      existing_visit_count: number;
      repeat_count: number;
      first_contact_count: number;
      send_count: number;
      inhouse_count: number;
      contact_acquired_count: number;
      repeat_plan_count: number;
    }> = {};

    for (const item of previousData ?? []) {
      const id = item.member_id;

      if (!previous[id]) {
        previous[id] = {
          sales: 0,
          champagne_count: 0,
          visit_count: 0,
          existing_visit_count: 0,
          repeat_count: 0,
          first_contact_count: 0,
          send_count: 0,
          inhouse_count: 0,
          contact_acquired_count: 0,
          repeat_plan_count: 0,
        };
      }

      previous[id].sales += Number(item.sales ?? 0);
      previous[id].champagne_count += Number(item.champagne_count ?? 0);
      previous[id].visit_count += Number(item.visit_count ?? 0);
      previous[id].existing_visit_count += Number(item.existing_visit_count ?? 0);
      previous[id].repeat_count += Number(item.repeat_count ?? 0);
      previous[id].first_contact_count += Number(item.first_contact_count ?? 0);
      previous[id].send_count += Number(item.send_count ?? 0);
      previous[id].inhouse_count += Number(item.inhouse_count ?? 0);
      previous[id].contact_acquired_count += Number(item.contact_acquired_count ?? 0);
      previous[id].repeat_plan_count += Number(item.repeat_plan_count ?? 0);
    }

    const payload = targets.map((row) => ({
      member_id: row.member_id,
      team_id: row.team_id,
      business_date: businessDate,

      sales: Number(row.sales || 0) - (previous[row.member_id]?.sales ?? 0),
      champagne_count: Number(row.champagne_count || 0) - (previous[row.member_id]?.champagne_count ?? 0),
      visit_count: Number(row.visit_count || 0) - (previous[row.member_id]?.visit_count ?? 0),
      existing_visit_count: Number(row.existing_visit_count || 0) - (previous[row.member_id]?.existing_visit_count ?? 0),

      repeat_count: Number(row.repeat_count || 0) - (previous[row.member_id]?.repeat_count ?? 0),
      first_contact_count: Number(row.first_contact_count || 0) - (previous[row.member_id]?.first_contact_count ?? 0),
      send_count: Number(row.send_count || 0) - (previous[row.member_id]?.send_count ?? 0),
      inhouse_count: Number(row.inhouse_count || 0) - (previous[row.member_id]?.inhouse_count ?? 0),
      contact_acquired_count: Number(row.contact_acquired_count || 0) - (previous[row.member_id]?.contact_acquired_count ?? 0),
      repeat_plan_count: Number(row.repeat_plan_count || 0) - (previous[row.member_id]?.repeat_plan_count ?? 0),

      note: row.note.trim() || null,
    }));

    const { error } = await supabase
      .from("daily_results")
      .upsert(payload, {
        onConflict: "member_id,business_date",
      });

    if (error) {
      setMessage("ERROR: " + error.message);
      setSaving(false);
      return;
    }

    setExistingIds(
      new Set([
        ...Array.from(existingIds),
        ...targets.map((row) => row.member_id),
      ])
    );

    setMessage(`${targets.length}名分の月間累計を保存しました`);
    setSaving(false);

    const returnTeamId =
      new URLSearchParams(window.location.search).get("team");

    if (returnTeamId) {
      window.location.href = `/teams/${returnTeamId}`;
    }
  }

  const completedCount = useMemo(() => {
    return members.filter((member) =>
      existingIds.has(member.id)
    ).length;
  }, [members, existingIds]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        読み込み中...
      </main>
    );
  }

  if (!canEdit) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        <div className="mx-auto max-w-md px-4">
          <p className="text-xs tracking-[0.3em] text-zinc-500">
            SWAMP-FOG
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            日報
          </h1>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="font-bold">
              日報は部責以上が入力します
            </p>

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
    <main className="min-h-screen bg-black text-white pb-28">
      <div className="mx-auto w-full max-w-3xl px-4 pt-8">
        <p className="text-xs tracking-[0.3em] text-zinc-500">
          SWAMP-FOG
        </p>

        <h1 className="mt-2 text-3xl font-bold">月間累計入力</h1>
        <p className="mt-1 text-sm text-zinc-500">
          DAILY RESULT
        </p>

        {normalizedRole === "department_manager" &&
          teamOptions.length > 0 && (
            <section className="mt-6">
              <label className="block">
                <span className="text-sm text-zinc-500">
                  入力するチーム
                </span>

                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white"
                >
                  {teamOptions.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

        <section className="mt-8 rounded-2xl border border-zinc-800 p-4">
          <label className="block">
            <span className="text-sm text-zinc-400">
              営業日
            </span>

            <input
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white"
            />
          </label>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-zinc-400">
              入力状況
            </span>

            <span className="font-bold">
              {completedCount} / {members.length}名
            </span>
          </div>
        </section>

        {!canEdit && (
          <div className="mt-4 rounded-2xl border border-zinc-800 p-4 text-sm text-zinc-400">
            キャストアカウントは日報の閲覧のみ可能です。
          </div>
        )}

        <div className="mt-5 space-y-4">
          {[...members]
            .sort((a, b) => {
              const rowA = rows[a.id];
              const rowB = rows[b.id];

              const activeA =
                !!rowA &&
                (hasInput(rowA) || existingIds.has(a.id));

              const activeB =
                !!rowB &&
                (hasInput(rowB) || existingIds.has(b.id));

              if (activeA && !activeB) return -1;
              if (!activeA && activeB) return 1;

              return 0;
            })
            .map((member) => {
            const row = rows[member.id];

            if (!row) return null;

            const completed = existingIds.has(member.id);

            return (
              <section
                key={member.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">
                      {member.name}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {completed ? "入力済み" : "未入力"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
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
                    disabled={!canEdit}
                    onChange={(v) =>
                      change(member.id, "sales", v)
                    }
                  />

                  <Field
                    label="オリシャン"
                    value={row.champagne_count}
                    disabled={!canEdit}
                    onChange={(v) =>
                      change(
                        member.id,
                        "champagne_count",
                        v
                      )
                    }
                  />

                  <Field
                    label="来店組数"
                    value={row.visit_count}
                    disabled={!canEdit}
                    onChange={(v) =>
                      change(member.id, "visit_count", v)
                    }
                  />

                  <Field
                    label="既存来店"
                    value={row.existing_visit_count}
                    disabled={!canEdit}
                    onChange={(v) =>
                      change(
                        member.id,
                        "existing_visit_count",
                        v
                      )
                    }
                  />

                  <Field
                    label="リピート"
                    value={row.repeat_count}
                    disabled={!canEdit}
                    onChange={(v) =>
                      change(member.id, "repeat_count", v)
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
                    disabled={!canEdit}
                    onChange={(v) =>
                      change(
                        member.id,
                        "first_contact_count",
                        v
                      )
                    }
                  />

                  <Field
                    label="送り"
                    value={row.send_count}
                    disabled={!canEdit}
                    onChange={(v) =>
                      change(member.id, "send_count", v)
                    }
                  />

                  <Field
                    label="場内"
                    value={row.inhouse_count}
                    disabled={!canEdit}
                    onChange={(v) =>
                      change(member.id, "inhouse_count", v)
                    }
                  />

                  <Field
                    label="連絡先取得"
                    value={row.contact_acquired_count}
                    disabled={!canEdit}
                    onChange={(v) =>
                      change(
                        member.id,
                        "contact_acquired_count",
                        v
                      )
                    }
                  />

                  <Field
                    label="リピート予定"
                    value={row.repeat_plan_count}
                    disabled={!canEdit}
                    onChange={(v) =>
                      change(
                        member.id,
                        "repeat_plan_count",
                        v
                      )
                    }
                  />
                    </div>
                  </details>
                </div>

                <label className="mt-3 block">
                  <span className="text-xs text-zinc-500">
                    メモ
                  </span>

                  <textarea
                    value={row.note}
                    disabled={!canEdit}
                    onChange={(e) =>
                      change(
                        member.id,
                        "note",
                        e.target.value
                      )
                    }
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
                  disabled={saving}
                  className="w-full rounded-xl border border-red-900 py-3 text-sm font-bold text-red-400 disabled:opacity-40"
                >
                  この日のデータを削除
                </button>

                <button
                  type="button"
                  onClick={resetCurrentMonth}
                  disabled={saving}
                  className="w-full rounded-xl bg-red-950 py-3 text-sm font-bold text-red-300 disabled:opacity-40"
                >
                  今月の対象データを全リセット
                </button>
              </div>
            </details>

            <div className="sticky bottom-16 z-40 mt-6 bg-black/95 py-3">
              <button
                onClick={saveAll}
                disabled={saving}
                className="w-full rounded-2xl bg-white py-4 font-bold text-black shadow-lg disabled:opacity-50"
              >
                {saving
                  ? "保存中..."
                  : "入力した日報を一括保存"}
              </button>
            </div>
          </>
        )}

        {message && (
          <p className="mt-4 text-center text-sm">
            {message}
          </p>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 pt-1">
          <Link
            href="/"
            className="py-2.5 text-center text-[10px] text-zinc-600"
          >
            <span className="block text-lg leading-none">⌂</span>
            <span className="mt-1 block">ホーム</span>
          </Link>

          <Link
            href="/members"
            className="py-2.5 text-center text-[10px] text-zinc-600"
          >
            <span className="block text-lg leading-none">♙</span>
            <span className="mt-1 block">メンバー</span>
          </Link>

          <Link
            href="/daily"
            className="py-2.5 text-center text-[10px] font-bold text-white"
          >
            <span className="block text-lg leading-none">✎</span>
            <span className="mt-1 block">日報</span>
          </Link>

          <Link
            href="/settings"
            className="py-2.5 text-center text-[10px] text-zinc-600"
          >
            <span className="block text-lg leading-none">⚙</span>
            <span className="mt-1 block">設定</span>
          </Link>
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
      <span className="text-xs text-zinc-500">
        {label}
      </span>

      <input
        type="number"
        inputMode="numeric"
        min="0"
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
