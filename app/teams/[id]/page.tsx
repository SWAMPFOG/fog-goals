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
existing_visit_count: number | null;
repeat_count: number | null;
first_contact_count: number | null;
send_count: number | null;
inhouse_count: number | null;
contact_acquired_count: number | null;
repeat_plan_count: number | null;
};

type TeamGoal = {
  id: string;
  target_sales: number;
  champagne_target: number;
  visit_count_target: number;
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function yen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
}
function rate(current: number, target: number) {
if (target <= 0) return 0;
return Math.min(100, Math.round((current / target) * 100));
}

export default function TeamDetailPage() {
const params = useParams();
const router = useRouter();
const teamId = params.id as string;

const [supabase] = useState(() => createClient());

const [team, setTeam] = useState<Team | null>(null);
const [members, setMembers] = useState<Member[]>([]);
const [results, setResults] = useState<DailyResult[]>([]);
const [goal, setGoal] = useState<TeamGoal | null>(null);

const [memberGoals, setMemberGoals] = useState<
  {
    member_id: string;
    target_sales: number | null;
    champagne_target: number | null;
    visit_count_target: number | null;
  }[]
>([]);
const [month, setMonth] = useState(currentMonth());
const [targetSales, setTargetSales] = useState("");
const [champagneTarget, setChampagneTarget] = useState("");
const [visitTarget, setVisitTarget] = useState("");

const [editing, setEditing] = useState(false);
const [saving, setSaving] = useState(false);
const [loading, setLoading] = useState(true);
const [message, setMessage] = useState("");
const [errorMessage, setErrorMessage] = useState("");
const [role, setRole] = useState<string | null>(null);
const [profileTeamId, setProfileTeamId] = useState<string | null>(null);
const [profileDepartmentId, setProfileDepartmentId] = useState<string | null>(null);
const [accessDenied, setAccessDenied] = useState(false);

// ランキングのタブ選択状態
const [rankTab, setRankTab] = useState("sales");

useEffect(() => {
async function load() {
setLoading(true);
setErrorMessage("");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    router.replace("/login");
    return;
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("role, team_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    setErrorMessage(profileError.message);
    setLoading(false);
    return;
  }

  setRole(profileData?.role ?? null);
  setProfileTeamId(profileData?.team_id ?? null);

  let ownDepartmentId: string | null = null;
  if (profileData?.team_id) {
    const { data: ownTeam, error: ownTeamError } = await supabase
      .from("teams")
      .select("department_id")
      .eq("id", profileData.team_id)
      .maybeSingle();

    if (ownTeamError) {
      setErrorMessage(ownTeamError.message);
      setLoading(false);
      return;
    }

    ownDepartmentId = ownTeam?.department_id ?? null;
  }

  setProfileDepartmentId(ownDepartmentId);

  const targetMonth = `${month}-01`;

  const [year, monthNumber] = month.split("-").map(Number);
  const nextDate = new Date(year, monthNumber, 1);
  const nextMonth = `${nextDate.getFullYear()}-${String(
    nextDate.getMonth() + 1
  ).padStart(2, "0")}-01`;

  const [
    teamResult,
    membersResult,
    dailyResult,
    goalResult,
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, department_id")
      .eq("id", teamId)
      .eq("is_active", true)
      .single(),

    supabase
      .from("members")
      .select("id, name, display_order")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .order("display_order"),

    supabase
      .from("daily_results")
      .select("member_id, sales, champagne_count, visit_count, existing_visit_count, repeat_count, first_contact_count, send_count, inhouse_count, contact_acquired_count, repeat_plan_count")
      .eq("team_id", teamId)
      .gte("business_date", targetMonth)
      .lt("business_date", nextMonth),

    supabase
      .from("team_goals")
      .select(
        "id, target_sales, champagne_target, visit_count_target"
      )
      .eq("team_id", teamId)
      .eq("target_month", targetMonth)
      .maybeSingle(),
  ]);

  if (teamResult.error) {
    setErrorMessage(teamResult.error.message);
    setLoading(false);
    return;
  }

  if (membersResult.error) {
    setErrorMessage(membersResult.error.message);
    setLoading(false);
    return;
  }

  if (dailyResult.error) {
    setErrorMessage(dailyResult.error.message);
    setLoading(false);
    return;
  }

  if (goalResult.error) {
    setErrorMessage(goalResult.error.message);
    setLoading(false);
    return;
  }

  const normalizedRole = normalizeRole(profileData?.role ?? null);
  let canViewThisTeam = true;

  if (normalizedRole === "member" || normalizedRole === "team_manager") {
    canViewThisTeam = profileData?.team_id === teamId;
  } else if (normalizedRole === "department_manager") {
    if (!profileData?.team_id) {
      canViewThisTeam = false;
    } else {
      const { data: ownTeam, error: ownTeamError } = await supabase
        .from("teams")
        .select("department_id")
        .eq("id", profileData.team_id)
        .maybeSingle();

      if (ownTeamError) {
        setErrorMessage(ownTeamError.message);
        setLoading(false);
        return;
      }

      canViewThisTeam =
        !!ownTeam?.department_id &&
        ownTeam.department_id === teamResult.data.department_id;
    }
  }

  if (!canViewThisTeam) {
    setAccessDenied(true);
    setLoading(false);
    return;
  }

  setAccessDenied(false);
  setTeam(teamResult.data);
  setMembers(membersResult.data ?? []);
  setResults(dailyResult.data ?? []);

  const { data: memberGoalData, error: memberGoalError } =
    await supabase
      .from("monthly_goals")
      .select(
        "member_id, target_sales, champagne_target, visit_count_target"
      )
      .eq("team_id", teamId)
      .eq("target_month", targetMonth);

  if (memberGoalError) {
    setErrorMessage(memberGoalError.message);
    setLoading(false);
    return;
  }

  setMemberGoals(memberGoalData ?? []);

  if (goalResult.data) {
    setGoal(goalResult.data);
    setTargetSales(String(goalResult.data.target_sales ?? 0));
    setChampagneTarget(
      String(goalResult.data.champagne_target ?? 0)
    );
    setVisitTarget(
      String(goalResult.data.visit_count_target ?? 0)
    );
  } else {
    setGoal(null);
    setTargetSales("");
    setChampagneTarget("");
    setVisitTarget("");
  }

  setLoading(false);
}

if (teamId) load();

}, [teamId, month, router, supabase]);

const totals = useMemo(() => {
return results.reduce(
(sum, row) => ({
sales: sum.sales + Number(row.sales ?? 0),
champagne:
sum.champagne + Number(row.champagne_count ?? 0),
visits: sum.visits + Number(row.visit_count ?? 0),
existingVisits:
sum.existingVisits + Number(row.existing_visit_count ?? 0),
repeats:
sum.repeats + Number(row.repeat_count ?? 0),
firstContacts:
sum.firstContacts + Number(row.first_contact_count ?? 0),
sends:
sum.sends + Number(row.send_count ?? 0),
inhouse:
sum.inhouse + Number(row.inhouse_count ?? 0),
contacts:
sum.contacts + Number(row.contact_acquired_count ?? 0),
repeatPlans:
sum.repeatPlans + Number(row.repeat_plan_count ?? 0),
}),
{
sales: 0,
champagne: 0,
visits: 0,
existingVisits: 0,
repeats: 0,
firstContacts: 0,
sends: 0,
inhouse: 0,
contacts: 0,
repeatPlans: 0,
}
);
}, [results]);

// メンバーごとの月間集計（ランキング用）
const memberStats = useMemo(() => {
return members.map((member) => {
const agg = results
.filter((row) => row.member_id === member.id)
.reduce(
(sum, row) => ({
sales: sum.sales + Number(row.sales ?? 0),
champagne: sum.champagne + Number(row.champagne_count ?? 0),
visits: sum.visits + Number(row.visit_count ?? 0),
sends: sum.sends + Number(row.send_count ?? 0),
inhouse: sum.inhouse + Number(row.inhouse_count ?? 0),
repeats: sum.repeats + Number(row.repeat_count ?? 0),
}),
{ sales: 0, champagne: 0, visits: 0, sends: 0, inhouse: 0, repeats: 0 }
);

  return {
    id: member.id,
    name: member.name,
    sales: agg.sales,
    champagne: agg.champagne,
    visits: agg.visits,
    sends: agg.sends,
    inhouse: agg.inhouse,
    repeats: agg.repeats,
    inhouseRate: agg.sends > 0 ? (agg.inhouse / agg.sends) * 100 : 0,
    repeatRate: agg.sends > 0 ? (agg.repeats / agg.sends) * 100 : 0,
  };
});

}, [members, results]);

const salesTarget = goal?.target_sales ?? 0;
const champagneGoal = goal?.champagne_target ?? 0;
const visitGoal = goal?.visit_count_target ?? 0;

const normalizedRole = normalizeRole(role);

const canEditThisTeam =
canEditTeamGoal(role) &&
(normalizedRole === "team_manager"
? !!profileTeamId && profileTeamId === teamId
: normalizedRole === "department_manager"
? !!profileDepartmentId &&
!!team?.department_id &&
profileDepartmentId === team.department_id
: normalizedRole !== "member");

const memberGoalTotals = useMemo(() => {
return memberGoals.reduce(
(sum, row) => ({
sales: sum.sales + Number(row.target_sales ?? 0),
champagne:
sum.champagne + Number(row.champagne_target ?? 0),
visits:
sum.visits + Number(row.visit_count_target ?? 0),
}),
{
sales: 0,
champagne: 0,
visits: 0,
}
);
}, [memberGoals]);

const unallocatedSales = Math.max(
0,
salesTarget - memberGoalTotals.sales
);

const unallocatedChampagne = Math.max(
0,
champagneGoal - memberGoalTotals.champagne
);

const unallocatedVisits = Math.max(
0,
visitGoal - memberGoalTotals.visits
);

async function saveGoal() {
setMessage("");
setErrorMessage("");

// 保存直前にも権限を再確認する。
// 画面上のボタン非表示だけに依存せず、URL直打ち・状態変更時の保存も防ぐ。
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  router.replace("/login");
  return;
}

const { data: latestProfile, error: latestProfileError } = await supabase
  .from("profiles")
  .select("role, team_id")
  .eq("id", user.id)
  .maybeSingle();

if (latestProfileError) {
  setErrorMessage(latestProfileError.message);
  return;
}

const latestRole = normalizeRole(latestProfile?.role ?? null);
let latestDepartmentId: string | null = null;

if (latestProfile?.team_id) {
  const { data: latestOwnTeam, error: latestOwnTeamError } = await supabase
    .from("teams")
    .select("department_id")
    .eq("id", latestProfile.team_id)
    .maybeSingle();

  if (latestOwnTeamError) {
    setErrorMessage(latestOwnTeamError.message);
    return;
  }

  latestDepartmentId = latestOwnTeam?.department_id ?? null;
}

const latestCanEditThisTeam =
  canEditTeamGoal(latestProfile?.role ?? null) &&
  (latestRole === "team_manager"
    ? !!latestProfile?.team_id && latestProfile.team_id === teamId
    : latestRole === "department_manager"
      ? !!latestDepartmentId &&
        !!team?.department_id &&
        latestDepartmentId === team.department_id
      : latestRole !== "member");

if (!latestCanEditThisTeam) {
  setEditing(false);
  setErrorMessage("このチームの目標を編集する権限がありません");
  return;
}

setSaving(true);

const payload = {
  team_id: teamId,
  target_month: `${month}-01`,
  target_sales: Number(targetSales || 0),
  champagne_target: Number(champagneTarget || 0),
  visit_count_target: Number(visitTarget || 0),
  updated_at: new Date().toISOString(),
};

const { data, error } = await supabase
  .from("team_goals")
  .upsert(payload, {
    onConflict: "team_id,target_month",
  })
  .select(
    "id, target_sales, champagne_target, visit_count_target"
  )
  .single();

if (error) {
  setErrorMessage(error.message);
  setSaving(false);
  return;
}

setGoal(data);
setMessage("保存しました");
setEditing(false);
setSaving(false);

}

if (loading) {
return (
<main className="min-h-screen bg-black text-white flex items-center justify-center">
<p className="text-zinc-500">読み込み中...</p>
</main>
);
}

if (accessDenied) {
return (
<main className="min-h-screen bg-black text-white px-5 py-8">
<div className="mx-auto max-w-md">
<Link href="/teams" className="text-sm text-zinc-500">
← チーム一覧
</Link>

      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-lg font-bold">閲覧権限がありません</p>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          このアカウントでは、このチームの情報を閲覧できません。
        </p>
      </div>
    </div>
  </main>
);

}

// ランキングのタブ定義（表示順・ラベル・値の取り出し・整形をここで管理）
const rankingTabs: {
key: string;
label: string;
getValue: (m: (typeof memberStats)[number]) => number;
format: (v: number) => string;
}[] = [
{ key: "sales", label: "売上", getValue: (m) => m.sales, format: (v) => yen(v) },
{ key: "champagne", label: "オリシャン", getValue: (m) => m.champagne, format: (v) => ${v}本 },
{ key: "visits", label: "来店", getValue: (m) => m.visits, format: (v) => ${v}組 },
{ key: "sends", label: "送り", getValue: (m) => m.sends, format: (v) => ${v}件 },
{ key: "inhouse", label: "場内", getValue: (m) => m.inhouse, format: (v) => ${v}件 },
{ key: "inhouseRate", label: "場内率", getValue: (m) => m.inhouseRate, format: (v) => ${Math.round(v * 10) / 10}% },
{ key: "repeats", label: "リピート", getValue: (m) => m.repeats, format: (v) => ${v}組 },
{ key: "repeatRate", label: "リピート率", getValue: (m) => m.repeatRate, format: (v) => ${Math.round(v * 10) / 10}% },
];

const activeTab =
rankingTabs.find((tab) => tab.key === rankTab) ?? rankingTabs[0];

const rankedMembers = [...memberStats].sort(
(a, b) => activeTab.getValue(b) - activeTab.getValue(a)
);

function rankLabel(index: number) {
if (index === 0) return "🥇";
if (index === 1) return "🥈";
if (index === 2) return "🥉";
return ${index + 1}位;
}

return (
<main className="min-h-screen bg-black text-white pb-24">
<div className="mx-auto w-full max-w-md px-5 pt-8">
<Link
       href="/teams"
       className="text-sm text-zinc-500"
     >
← チーム一覧
</Link>

    <header className="mt-6 mb-6">
      <p className="text-xs tracking-[0.3em] text-zinc-500">
        SWAMP-FOG
      </p>

      <h1 className="mt-2 text-3xl font-bold">
        {team?.name ?? "TEAM"}
      </h1>

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
        onChange={(e) => setMonth(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
      />
    </label>

    {errorMessage && (
      <section className="mb-4 rounded-2xl border border-red-900 p-4">
        <p className="text-sm text-red-400">
          ERROR: {errorMessage}
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
            {goal ? yen(salesTarget) : "未設定"}
          </p>
        </div>

        {canEditThisTeam ? (
          <button
            onClick={() => setEditing(!editing)}
            className="rounded-xl border border-zinc-700 px-3 py-2 text-xs"
          >
            {editing ? "閉じる" : "目標設定"}
          </button>
        ) : (
          <span className="text-xs text-zinc-600">
            閲覧のみ
          </span>
        )}
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-white"
          style={{
            width: `${rate(totals.sales, salesTarget)}%`,
          }}
        />
      </div>

      <div className="mt-3 flex justify-between text-xs text-zinc-500">
        <span>現在 {yen(totals.sales)}</span>
        <span>
          達成率 {rate(totals.sales, salesTarget)}%
        </span>
      </div>

      <p className="mt-4 text-sm text-zinc-400">
        残り {yen(Math.max(0, salesTarget - totals.sales))}
      </p>
    </section>

    <section className="mt-3 grid grid-cols-2 gap-3">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
        <p className="text-xs text-zinc-500">
          オリシャン目標
        </p>
        <p className="mt-2 text-2xl font-bold">
          {goal ? `${champagneGoal}本` : "未設定"}
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          現在 {totals.champagne}本
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          残り{" "}
          {Math.max(
            0,
            champagneGoal - totals.champagne
          )}
          本
        </p>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
        <p className="text-xs text-zinc-500">
          来店組数目標
        </p>
        <p className="mt-2 text-2xl font-bold">
          {goal ? `${visitGoal}組` : "未設定"}
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          現在 {totals.visits}組
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          残り {Math.max(0, visitGoal - totals.visits)}組
        </p>
      </div>
    </section>

    {editing && canEditThisTeam && (
      <section className="mt-4 rounded-3xl border border-zinc-700 bg-zinc-950 p-5">
        <p className="text-lg font-bold">
          チーム目標設定
        </p>

        <div className="mt-5 space-y-4">
          <input
            type="number"
            value={targetSales}
            onChange={(e) => setTargetSales(e.target.value)}
            placeholder="売上目標"
            className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3"
          />

          <input
            type="number"
            value={champagneTarget}
            onChange={(e) =>
              setChampagneTarget(e.target.value)
            }
            placeholder="オリシャン目標"
            className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3"
          />

          <input
            type="number"
            value={visitTarget}
            onChange={(e) => setVisitTarget(e.target.value)}
            placeholder="来店組数目標"
            className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3"
          />

          <button
            onClick={saveGoal}
            disabled={saving}
            className="w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存する"}
          </button>

          {message && (
            <p className="text-center text-sm text-green-400">
              {message}
            </p>
          )}
        </div>
      </section>
    )}

    <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-xs text-zinc-500">
        TEAM MONTHLY RESULT
      </p>

      <h2 className="mt-2 text-xl font-bold">
        チーム月間営業実績
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <TeamResultBox label="既存来店" value={`${totals.existingVisits}組`} />
        <TeamResultBox label="リピート" value={`${totals.repeats}組`} />
        <TeamResultBox label="初回" value={`${totals.firstContacts}組`} />
        <TeamResultBox label="送り" value={`${totals.sends}件`} />
        <TeamResultBox label="場内" value={`${totals.inhouse}件`} />
        <TeamResultBox label="連絡先取得" value={`${totals.contacts}件`} />
        <TeamResultBox label="リピート予定" value={`${totals.repeatPlans}件`} />
      </div>
    </section>

    <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-xs text-zinc-500">
        TEAM RANKING
      </p>

      <h2 className="mt-2 text-xl font-bold">
        チーム内ランキング
      </h2>

      {/* ランキング種類を横スクロールタブで切り替え */}
      <div className="mt-4 -mx-5 overflow-x-auto px-5">
        <div className="flex gap-2 whitespace-nowrap">
          {rankingTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRankTab(tab.key)}
              className={`rounded-full border px-4 py-2 text-sm ${
                tab.key === rankTab
                  ? "border-white bg-white font-bold text-black"
                  : "border-zinc-800 bg-black text-zinc-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {rankedMembers.length === 0 ? (
          <p className="text-sm text-zinc-500">メンバーがいません</p>
        ) : (
          rankedMembers.map((member, index) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-2xl bg-zinc-900 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-lg font-bold">
                  {rankLabel(index)}
                </span>
                <span className="text-sm font-bold">
                  {member.name}
                </span>
              </div>

              <span className="text-sm font-bold">
                {activeTab.format(activeTab.getValue(member))}
              </span>
            </div>
          ))
        )}
      </div>
    </section>

    <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-xs text-zinc-500">
        GOAL ALLOCATION
      </p>

      <h2 className="mt-2 text-xl font-bold">
        個人目標への配分状況
      </h2>

      <div className="mt-5 space-y-5">
        <div>
          <p className="text-xs text-zinc-500">売上</p>
          <div className="mt-2 flex justify-between">
            <span className="text-sm">チーム目標</span>
            <span className="font-bold">{yen(salesTarget)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-sm text-zinc-500">個人目標合計</span>
            <span>{yen(memberGoalTotals.sales)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-sm text-zinc-500">
              {unallocatedSales > 0 ? "未配分" : "達成状況"}
            </span>
            <span className={unallocatedSales <= 0 ? "font-bold text-white" : ""}>

{unallocatedSales > 0
? yen(unallocatedSales)
: unallocatedSales === 0
? "✓ 目標達成"
: ✓ 目標達成 +${yen(Math.abs(unallocatedSales))}}
</span>
</div>
</div>

        <div className="border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-500">オリシャン</p>
          <div className="mt-2 flex justify-between">
            <span className="text-sm">チーム目標</span>
            <span className="font-bold">{champagneGoal}本</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-sm text-zinc-500">個人目標合計</span>
            <span>{memberGoalTotals.champagne}本</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-sm text-zinc-500">
              {unallocatedChampagne > 0 ? "未配分" : "達成状況"}
            </span>
            <span className={unallocatedChampagne <= 0 ? "font-bold text-white" : ""}>

{unallocatedChampagne > 0
? ${unallocatedChampagne}本
: unallocatedChampagne === 0
? "✓ 目標達成"
: ✓ 目標達成 +${Math.abs(unallocatedChampagne)}本}
</span>
</div>
</div>

        <div className="border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-500">来店組数</p>
          <div className="mt-2 flex justify-between">
            <span className="text-sm">チーム目標</span>
            <span className="font-bold">{visitGoal}組</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-sm text-zinc-500">個人目標合計</span>
            <span>{memberGoalTotals.visits}組</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-sm text-zinc-500">
              {unallocatedVisits > 0 ? "未配分" : "達成状況"}
            </span>
            <span className={unallocatedVisits <= 0 ? "font-bold text-white" : ""}>

{unallocatedVisits > 0
? ${unallocatedVisits}組
: unallocatedVisits === 0
? "✓ 目標達成"
: ✓ 目標達成 +${Math.abs(unallocatedVisits)}組}
</span>
</div>
</div>
</div>
</section>

    <section className="mt-6">
      <p className="text-xs text-zinc-500">
        TEAM MEMBERS
      </p>

      <h2 className="mt-2 text-xl font-bold">
        メンバー
      </h2>

      <div className="mt-4 space-y-3">
        {members.map((member) => {
          const memberGoal = memberGoals.find(
            (row) => row.member_id === member.id
          );

          const memberResult = results
            .filter((row) => row.member_id === member.id)
            .reduce(
              (sum, row) => ({
                sales: sum.sales + Number(row.sales ?? 0),
                champagne:
                  sum.champagne + Number(row.champagne_count ?? 0),
                visits:
                  sum.visits + Number(row.visit_count ?? 0),
              }),
              {
                sales: 0,
                champagne: 0,
                visits: 0,
              }
            );

          const memberSalesTarget =
            Number(memberGoal?.target_sales ?? 0);

          const memberChampagneTarget =
            Number(memberGoal?.champagne_target ?? 0);

          const memberVisitTarget =
            Number(memberGoal?.visit_count_target ?? 0);

          const memberSalesRate = rate(
            memberResult.sales,
            memberSalesTarget
          );

          return (
            <Link
              key={member.id}
              href={`/members/${member.id}`}
              className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">
                  {member.name}
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
                    {yen(memberResult.sales)}
                    {" / "}
                    {memberSalesTarget > 0
                      ? yen(memberSalesTarget)
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
                    {memberSalesTarget > 0
                      ? `個人目標達成率 ${memberSalesRate}%`
                      : "個人目標未設定"}
                  </span>

                  <span>
                    {salesTarget > 0
                      ? `チーム貢献率 ${Math.round((memberResult.sales / salesTarget) * 1000) / 10}%`
                      : "チーム目標未設定"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-900 p-3">
                  <p className="text-xs text-zinc-500">
                    オリシャン
                  </p>

                  <p className="mt-1 font-bold">
                    {memberResult.champagne}
                    {" / "}
                    {memberChampagneTarget > 0
                      ? `${memberChampagneTarget}本`
                      : "未設定"}
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-900 p-3">
                  <p className="text-xs text-zinc-500">
                    来店組数
                  </p>

                  <p className="mt-1 font-bold">
                    {memberResult.visits}
                    {" / "}
                    {memberVisitTarget > 0
                      ? `${memberVisitTarget}組`
                      : "未設定"}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  </div>

  <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-900 bg-black/95">
    <div className="mx-auto grid max-w-md grid-cols-4">
      <Link href="/" className="py-4 text-center text-xs text-zinc-600">
        ホーム
      </Link>
      <Link href="/teams" className="py-4 text-center text-xs font-bold text-white">
        チーム
      </Link>
      <Link href="/daily" className="py-4 text-center text-xs text-zinc-600">
        日報
      </Link>
      <Link href="/settings" className="py-4 text-center text-xs text-zinc-600">
        設定
      </Link>
    </div>
  </nav>
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
<p className="text-xs text-zinc-500">{label}</p>
<p className="mt-1 text-xl font-bold">{value}</p>
</div>
);
