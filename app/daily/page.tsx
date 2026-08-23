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
      } else if (currentRole === "department_manager") {
        if (!currentDepartmentId) {
          setMembers([]);
          setRows({});
          setMessage("ERROR: 所属営業部が未設定です");
          setLoading(false);
          return;
        }

        const { data: departmentTeams, error: departmentTeamsError } =
          await supabase
            .from("teams")
            .select("id")
            .eq("department_id", currentDepartmentId)
            .eq("is_active", true);

        if (departmentTeamsError) {
          setMessage("ERROR: " + departmentTeamsError.message);
          setLoading(false);
          return;
        }

        const departmentTeamIds = (departmentTeams ?? []).map((team) => team.id);

        if (departmentTeamIds.length === 0) {
          setMembers([]);
          setRows({});
          setLoading(false);
          return;
        }

        memberQuery = memberQuery.in("team_id", departmentTeamIds);
      } else if (currentRole === "member") {
        setMembers([]);
        setRows({});
        setLoading(false);
        return;
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

      const { data, error } = await supabase
        .from("daily_results")
        .select(`
          member_id,
          team_id,
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
        .eq("business_date", businessDate)
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
        existing.add(item.member_id);

        next[item.member_id] = {
          member_id: item.member_id,
          team_id: item.team_id,
          sales: String(item.sales ?? 0),
          champagne_count: String(item.champagne_count ?? 0),
          visit_count: String(item.visit_count ?? 0),
          existing_visit_count: String(item.existing_visit_count ?? 0),
          repeat_count: String(item.repeat_count ?? 0),
          first_contact_count: String(item.first_contact_count ?? 0),
          send_count: String(item.send_count ?? 0),
          inhouse_count: String(item.inhouse_count ?? 0),
          contact_acquired_count: String(item.contact_acquired_count ?? 0),
          repeat_plan_count: String(item.repeat_plan_count ?? 0),
          note: item.note ?? "",
        };
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

    const payload = targets.map((row) => ({
      member_id: row.member_id,
      team_id: row.team_id,
      business_date: businessDate,

      sales: Number(row.sales || 0),
      champagne_count: Number(row.champagne_count || 0),
      visit_count: Number(row.visit_count || 0),
      existing_visit_count: Number(row.existing_visit_count || 0),

      repeat_count: Number(row.repeat_count || 0),
      first_contact_count: Number(row.first_contact_count || 0),
      send_count: Number(row.send_count || 0),
      inhouse_count: Number(row.inhouse_count || 0),
      contact_acquired_count: Number(row.contact_acquired_count || 0),
      repeat_plan_count: Number(row.repeat_plan_count || 0),

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

    setMessage(`${targets.length}名分の日報を保存しました`);
    setSaving(false);
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
        <div className="mx-auto max-w-md">
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

        <h1 className="mt-2 text-3xl font-bold">日報</h1>
        <p className="mt-1 text-sm text-zinc-500">
          DAILY RESULT
        </p>

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
          {members.map((member) => {
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
                    rows={2}
                    className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-white disabled:opacity-60"
                    placeholder="必要な場合のみ入力"
                  />
                </label>
              </section>
            );
          })}
        </div>

        {canEdit && (
          <button
            onClick={saveAll}
            disabled={saving}
            className="mt-6 w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
          >
            {saving
              ? "保存中..."
              : "入力した日報を一括保存"}
          </button>
        )}

        {message && (
          <p className="mt-4 text-center text-sm">
            {message}
          </p>
        )}
      </div>

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
            className="py-4 text-center text-xs text-zinc-600"
          >
            メンバー
          </Link>

          <Link
            href="/daily"
            className="py-4 text-center text-xs font-bold text-white"
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
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-white disabled:opacity-60"
      />
    </label>
  );
}
