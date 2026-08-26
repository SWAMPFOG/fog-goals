"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type DailyResult = {
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

type StoreGoal = {
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

function yen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function currentMonth() {
  const d = new Date();
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
  };
}

function rate(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function roleLabel(role?: string | null) {
  switch (role) {
    case "cast": return "キャスト";
    case "team_manager": return "部責";
    case "department_manager": return "営業部責任者";
    case "business_manager": return "業責";
    case "company_manager": return "社責";
    case "chairman": return "会長";
    default: return "未設定";
  }
}

function scopeLabel(role?: string | null) {
  switch (role) {
    case "cast": return "自分の月間実績";
    case "team_manager": return "自チーム月間実績";
    case "department_manager": return "担当営業部月間実績";
    default: return "店舗月間実績";
  }
}

function canSeeStore(profile: UserProfile | null) {
  return !!profile && ["business_manager", "company_manager", "chairman"].includes(profile.role);
}

export default function HomePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<DailyResult[]>([]);
  const [storeGoal, setStoreGoal] = useState<StoreGoal | null>(null);
  const [castMemberGoal, setCastMemberGoal] = useState<StoreGoal | null>(null);
  const [castTeamGoal, setCastTeamGoal] = useState<StoreGoal | null>(null);
  const [castTeamSales, setCastTeamSales] = useState(0);
  const month = useMemo(() => currentMonth(), []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, department_id, team_id, member_id, display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        setErrorMessage(profileError?.message ?? "プロフィールが見つかりません");
        setLoading(false);
        return;
      }

      const p = profileData as UserProfile;
      setProfile(p);
      setEmail(user.email ?? "");

      const startDate = `${month.key}-01`;
      const [year, monthNumber] = month.key.split("-").map(Number);
      const next = new Date(year, monthNumber, 1);
      const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;

      // 役職ごとに閲覧可能な member_id を確定する。
      // cast: 自分 / team_manager: 自チーム / department_manager: 自営業部 / 業責以上: 店舗全体
      let allowedMemberIds: string[] | null = null;

      if (p.role === "cast") {
        allowedMemberIds = p.member_id ? [p.member_id] : [];
      } else if (p.role === "team_manager") {
        if (!p.team_id) {
          allowedMemberIds = [];
        } else {
          const { data, error } = await supabase.from("members").select("id").eq("team_id", p.team_id);
          if (error) {
            setErrorMessage(error.message); setLoading(false); return;
          }
          allowedMemberIds = (data ?? []).map((row: { id: string }) => row.id);
        }
      } else if (p.role === "department_manager") {
        if (!p.department_id) {
          allowedMemberIds = [];
        } else {
          const { data: teamData, error: teamError } = await supabase
            .from("teams").select("id").eq("department_id", p.department_id);
          if (teamError) {
            setErrorMessage(teamError.message); setLoading(false); return;
          }
          const teamIds = (teamData ?? []).map((row: { id: string }) => row.id);
          if (teamIds.length === 0) {
            allowedMemberIds = [];
          } else {
            const { data: memberData, error: memberError } = await supabase
              .from("members").select("id").in("team_id", teamIds);
            if (memberError) {
              setErrorMessage(memberError.message); setLoading(false); return;
            }
            allowedMemberIds = (memberData ?? []).map((row: { id: string }) => row.id);
          }
        }
      } else if (["business_manager", "company_manager", "chairman"].includes(p.role)) {
        allowedMemberIds = null;
      } else {
        // 未知の役職は安全側に倒して実績を表示しない。
        allowedMemberIds = [];
      }

      let dailyQuery = supabase
        .from("daily_results")
        .select("sales, champagne_count, visit_count, existing_visit_count, repeat_count, first_contact_count, send_count, inhouse_count, contact_acquired_count, repeat_plan_count")
        .gte("business_date", startDate)
        .lt("business_date", nextMonth);

      if (allowedMemberIds !== null) {
        if (allowedMemberIds.length === 0) {
          setResults([]);
        } else {
          dailyQuery = dailyQuery.in("member_id", allowedMemberIds);
          const { data, error } = await dailyQuery;
          if (error) {
            setErrorMessage(error.message); setLoading(false); return;
          }
          setResults(data ?? []);
        }
      } else {
        const { data, error } = await dailyQuery;
        if (error) {
          setErrorMessage(error.message); setLoading(false); return;
        }
        setResults(data ?? []);
      }

      // キャストは自分の目標 + 所属チームの目標/実績を取得
      if (p.role === "cast" && p.member_id && p.team_id) {
        const [memberGoalResult, teamGoalResult, teamDailyResult] =
          await Promise.all([
            supabase
              .from("monthly_goals")
              .select("target_sales, champagne_target, visit_count_target")
              .eq("member_id", p.member_id)
              .eq("target_month", startDate)
              .maybeSingle(),

            supabase
              .from("team_goals")
              .select("target_sales, champagne_target, visit_count_target")
              .eq("team_id", p.team_id)
              .eq("target_month", startDate)
              .maybeSingle(),

            supabase
              .from("daily_results")
              .select("sales")
              .eq("team_id", p.team_id)
              .gte("business_date", startDate)
              .lt("business_date", nextMonth),
          ]);

        if (memberGoalResult.error) {
          setErrorMessage(memberGoalResult.error.message);
          setLoading(false);
          return;
        }

        if (teamGoalResult.error) {
          setErrorMessage(teamGoalResult.error.message);
          setLoading(false);
          return;
        }

        if (teamDailyResult.error) {
          setErrorMessage(teamDailyResult.error.message);
          setLoading(false);
          return;
        }

        setCastMemberGoal(memberGoalResult.data ?? null);
        setCastTeamGoal(teamGoalResult.data ?? null);
        setCastTeamSales(
          (teamDailyResult.data ?? []).reduce(
            (sum, row) => sum + Number(row.sales ?? 0),
            0
          )
        );
      } else {
        setCastMemberGoal(null);
        setCastTeamGoal(null);
        setCastTeamSales(0);
      }

      // 業責以上は店舗目標、部責は自チーム目標を取得
      if (["business_manager", "company_manager", "chairman"].includes(p.role)) {
        const { data: goalData, error: goalError } = await supabase
          .from("store_goals")
          .select("target_sales, champagne_target, visit_count_target")
          .eq("target_month", startDate)
          .maybeSingle();

        if (goalError) {
          setErrorMessage(goalError.message);
          setLoading(false);
          return;
        }

        setStoreGoal(goalData ?? null);

      } else if (p.role === "team_manager" && p.team_id) {
        const { data: goalData, error: goalError } = await supabase
          .from("team_goals")
          .select("target_sales, champagne_target, visit_count_target")
          .eq("team_id", p.team_id)
          .eq("target_month", startDate)
          .maybeSingle();

        if (goalError) {
          setErrorMessage(goalError.message);
          setLoading(false);
          return;
        }

        setStoreGoal(goalData ?? null);

      } else {
        setStoreGoal(null);
      }

            setLoading(false);
    }

    load();
  }, [router, supabase, month.key]);

  const totals = useMemo(() => results.reduce(
    (sum, row) => ({
      sales: sum.sales + Number(row.sales ?? 0),
      champagne: sum.champagne + Number(row.champagne_count ?? 0),
      visits: sum.visits + Number(row.visit_count ?? 0),
      existingVisits: sum.existingVisits + Number(row.existing_visit_count ?? 0),
      repeats: sum.repeats + Number(row.repeat_count ?? 0),
      firstContacts: sum.firstContacts + Number(row.first_contact_count ?? 0),
      sends: sum.sends + Number(row.send_count ?? 0),
      inhouse: sum.inhouse + Number(row.inhouse_count ?? 0),
      contacts: sum.contacts + Number(row.contact_acquired_count ?? 0),
      repeatPlans: sum.repeatPlans + Number(row.repeat_plan_count ?? 0),
    }),
    { sales: 0, champagne: 0, visits: 0, existingVisits: 0, repeats: 0, firstContacts: 0, sends: 0, inhouse: 0, contacts: 0, repeatPlans: 0 }
  ), [results]);

  const salesTarget = storeGoal?.target_sales ?? 0;
  const champagneTarget = storeGoal?.champagne_target ?? 0;
  const visitTarget = storeGoal?.visit_count_target ?? 0;

  const castMemberTarget = castMemberGoal?.target_sales ?? 0;
  const castTeamTarget = castTeamGoal?.target_sales ?? 0;

  const castMemberRate = rate(totals.sales, castMemberTarget);
  const castTeamRate = rate(castTeamSales, castTeamTarget);

  const castContribution =
    castTeamTarget > 0
      ? Math.round((totals.sales / castTeamTarget) * 1000) / 10
      : 0;
  const salesRemaining = Math.max(0, salesTarget - totals.sales);
  const champagneRemaining = Math.max(0, champagneTarget - totals.champagne);
  const visitRemaining = Math.max(0, visitTarget - totals.visits);
  const salesRate = rate(totals.sales, salesTarget);
  const champagneRate = rate(totals.champagne, champagneTarget);
  const visitRate = rate(totals.visits, visitTarget);
  const storeView = canSeeStore(profile);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) return <main className="min-h-screen bg-black text-white flex items-center justify-center"><p className="text-zinc-500">読み込み中...</p></main>;

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <div className="mx-auto w-full max-w-md px-5 pt-4">
        <header className="sticky top-0 z-40 -mx-5 mb-6 border-b border-zinc-900 bg-black/90 px-5 pb-4 pt-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs tracking-[0.3em] text-zinc-500">SWAMP-FOG</p><h1 className="mt-2 text-3xl font-bold">FOG GOALS</h1><p className="mt-1 text-sm text-zinc-500">Team Goal Management</p></div>
            <button onClick={handleLogout} className="rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-400">ログアウト</button>
          </div>
          <div className="mt-4 flex items-end justify-between"><p className="text-xs text-zinc-700">{email}</p><div className="text-right"><p className="text-xs text-zinc-500">対象月</p><p className="mt-1 font-bold">{month.label}</p></div></div>
        </header>

        {profile && (
          <section className="mb-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs text-zinc-500">YOUR ROLE</p><p className="mt-1 text-xl font-bold">{roleLabel(profile.role)}</p></div>{profile.display_name && <p className="text-sm text-zinc-500">{profile.display_name}</p>}</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {profile.role === "cast" && profile.member_id && <Link href={`/members/${profile.member_id}`} className="rounded-2xl border border-zinc-800 p-4"><p className="text-xs text-zinc-500">PERSONAL</p><p className="mt-1 font-bold">自分の目標</p></Link>}
              {profile.role === "team_manager" && profile.team_id && <><Link href={`/teams/${profile.team_id}`} className="rounded-2xl border border-zinc-800 p-4"><p className="text-xs text-zinc-500">TEAM</p><p className="mt-1 font-bold">自チーム</p></Link><Link href="/daily" className="rounded-2xl border border-zinc-800 p-4"><p className="text-xs text-zinc-500">DAILY</p><p className="mt-1 font-bold">日報入力</p></Link></>}
              {profile.role === "department_manager" && profile.department_id && <><Link href={`/departments/${profile.department_id}`} className="rounded-2xl border border-zinc-800 p-4"><p className="text-xs text-zinc-500">DEPARTMENT</p><p className="mt-1 font-bold">担当営業部</p></Link><Link href="/teams" className="rounded-2xl border border-zinc-800 p-4"><p className="text-xs text-zinc-500">TEAMS</p><p className="mt-1 font-bold">チーム確認</p></Link><Link href="/daily" className="rounded-2xl border border-zinc-800 p-4"><p className="text-xs text-zinc-500">DAILY</p><p className="mt-1 font-bold">日報確認</p></Link></>}
              {storeView && <><Link href="/teams" className="rounded-2xl border border-zinc-800 p-4"><p className="text-xs text-zinc-500">TEAMS</p><p className="mt-1 font-bold">全チーム</p></Link><Link href="/members" className="rounded-2xl border border-zinc-800 p-4"><p className="text-xs text-zinc-500">MEMBERS</p><p className="mt-1 font-bold">全メンバー</p></Link><Link href="/daily" className="rounded-2xl border border-zinc-800 p-4"><p className="text-xs text-zinc-500">DAILY</p><p className="mt-1 font-bold">日報管理</p></Link><Link
          href="/summary"
          className="block rounded-3xl border border-zinc-800 p-5"
        >
          <p className="text-xs text-zinc-500">MANAGEMENT</p>
          <p className="mt-2 text-xl font-bold">集約ダッシュボード</p>
          <p className="mt-2 text-sm text-zinc-500">
            部責・業責・社責・会長向け集約
          </p>
        </Link>

        <Link href="/settings" className="rounded-2xl border border-zinc-800 p-4"><p className="text-xs text-zinc-500">SETTING</p><p className="mt-1 font-bold">目標設定</p></Link></>}
            </div>
          </section>
        )}

        {errorMessage && <section className="mb-4 rounded-3xl border border-red-900 p-4"><p className="text-sm text-red-400">ERROR: {errorMessage}</p></section>}

        {profile?.role === "cast" && (
        <section className="mb-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs text-zinc-500">MY PERFORMANCE</p>
          <h2 className="mt-2 text-2xl font-bold">自分の目標</h2>

          <div className="mt-5 rounded-2xl border border-zinc-800 bg-black p-4">
            <p className="text-xs text-zinc-500">個人売上目標</p>

            <p className="mt-2 text-2xl font-bold text-white">
              {castMemberTarget > 0 ? yen(castMemberTarget) : "未設定"}
            </p>

            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs text-zinc-500">現在売上</p>
                <p
                  className={`mt-1 text-3xl font-bold ${
                    castMemberTarget <= 0
                      ? "text-white"
                      : castMemberRate >= 100
                        ? "text-green-400"
                        : "text-red-400"
                  }`}
                >
                  {yen(totals.sales)}
                </p>
              </div>

              <p className="text-sm text-zinc-400">
                達成率 {castMemberRate}%
              </p>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${castMemberRate}%` }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500">目標まであと</span>

              {castMemberTarget > 0 ? (
                <span
                  className={`text-xl font-bold ${
                    castMemberRate >= 100
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {castMemberRate >= 100
                    ? "達成"
                    : yen(Math.max(0, castMemberTarget - totals.sales))}
                </span>
              ) : (
                <span className="text-sm text-zinc-500">未設定</span>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4">
            <p className="text-xs text-zinc-500">TEAM GOAL</p>
            <h3 className="mt-1 text-lg font-bold">チーム進捗</h3>

            <div className="mt-4 flex justify-between">
              <span className="text-sm text-zinc-500">チーム目標</span>
              <span className="font-bold text-white">
                {castTeamTarget > 0 ? yen(castTeamTarget) : "未設定"}
              </span>
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-sm text-zinc-500">チーム現在売上</span>
              <span
                className={`font-bold ${
                  castTeamTarget <= 0
                    ? "text-white"
                    : castTeamRate >= 100
                      ? "text-green-400"
                      : "text-red-400"
                }`}
              >
                {yen(castTeamSales)}
              </span>
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-sm text-zinc-500">チーム達成率</span>
              <span className="font-bold">{castTeamRate}%</span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${castTeamRate}%` }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-900 p-3">
              <span className="text-sm text-zinc-400">
                自分のチーム貢献度
              </span>
              <span className="text-2xl font-bold text-white">
                {castContribution}%
              </span>
            </div>
          </div>
        </section>
      )}

      {storeView && !storeGoal && <Link href="/settings" className="mb-4 block rounded-3xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs text-zinc-500">STORE GOAL</p><p className="mt-2 font-bold">店舗目標が未設定です</p><p className="mt-2 text-sm text-zinc-500">タップして店舗目標を設定</p></Link>}

        {storeView ? <>
          <GoalCard label="店舗月間売上目標" target={storeGoal ? yen(salesTarget) : "未設定"} current={`現在 ${yen(totals.sales)}`} rateValue={salesRate} remaining={yen(salesRemaining)} />
          <GoalCard label="オリシャン店舗目標" target={storeGoal ? `${champagneTarget}本` : "未設定"} current={`現在 ${totals.champagne}本`} rateValue={champagneRate} remaining={`${champagneRemaining}本`} />
          <GoalCard label="来店組数店舗目標" target={storeGoal ? `${visitTarget}組` : "未設定"} current={`現在 ${totals.visits}組`} rateValue={visitRate} remaining={`${visitRemaining}組`} />
        </> : (
          <section className="mb-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs text-zinc-500">MONTHLY RESULT</p><h2 className="mt-2 text-xl font-bold">{scopeLabel(profile?.role)}</h2>
            <div className="mb-4 rounded-2xl border border-zinc-800 bg-black p-4">
              <p className="text-xs text-zinc-500">自チーム売上目標</p>

              <div className="mt-2 flex items-end justify-between">
                <span className="text-2xl font-bold">
                  {yen(salesTarget)}
                </span>

                <span className="text-sm text-zinc-400">
                  達成率{" "}
                  {salesTarget > 0
                    ? Math.round((totals.sales / salesTarget) * 100)
                    : 0}
                  %
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-white"
                  style={{
                    width: `${
                      salesTarget > 0
                        ? Math.min(
                            100,
                            Math.round((totals.sales / salesTarget) * 100)
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="mt-3 flex justify-between text-sm">
                <span className="text-zinc-400">
                  現在 {yen(totals.sales)}
                </span>

                <span className="font-bold">
                  あと {yen(Math.max(0, salesTarget - totals.sales))}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3"><StoreResultBox label="売上" value={yen(totals.sales)} /><StoreResultBox label="オリシャン" value={`${totals.champagne}本`} /><StoreResultBox label="来店" value={`${totals.visits}組`} /><StoreResultBox label="既存来店" value={`${totals.existingVisits}組`} /></div>
          </section>
        )}

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs text-zinc-500">MONTHLY RESULT</p><h2 className="mt-2 text-xl font-bold">{scopeLabel(profile?.role)}</h2><div className="mt-4 grid grid-cols-2 gap-3"><StoreResultBox label="既存来店" value={`${totals.existingVisits}組`} /><StoreResultBox label="リピート" value={`${totals.repeats}組`} /><StoreResultBox label="初回" value={`${totals.firstContacts}組`} /><StoreResultBox label="送り" value={`${totals.sends}件`} /><StoreResultBox label="場内" value={`${totals.inhouse}件`} /><StoreResultBox label="連絡先取得" value={`${totals.contacts}件`} /><StoreResultBox label="リピート予定" value={`${totals.repeatPlans}件`} /></div></section>

        {storeView && <Link href="/settings" className="mt-4 block rounded-2xl border border-zinc-800 py-4 text-center text-sm font-bold">店舗目標を変更</Link>}

        {profile?.department_id && profile.role === "department_manager" && <Link href={`/departments/${profile.department_id}`} className="mt-4 block rounded-3xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs tracking-widest text-zinc-500">DEPARTMENT</p><div className="mt-2 flex items-center justify-between"><div><h2 className="text-xl font-bold">担当営業部</h2><p className="mt-1 text-sm text-zinc-500">営業部目標・チーム状況を見る</p></div><span className="text-zinc-500">→</span></div></Link>}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"><div className="mx-auto grid max-w-md grid-cols-4 px-2 pt-1"><Link href="/" className="py-2.5 text-center text-[10px] font-bold text-white"><span className="block text-lg leading-none">⌂</span><span className="mt-1 block">ホーム</span></Link><Link href="/members" className="py-2.5 text-center text-[10px] text-zinc-600"><span className="block text-lg leading-none">♙</span><span className="mt-1 block">メンバー</span></Link><Link href="/daily" className="py-2.5 text-center text-[10px] text-zinc-600"><span className="block text-lg leading-none">✎</span><span className="mt-1 block">日報</span></Link>{storeView ? <Link href="/settings" className="py-2.5 text-center text-[10px] text-zinc-600"><span className="block text-lg leading-none">⚙</span><span className="mt-1 block">設定</span></Link> : <span className="py-2.5 text-center text-[10px] text-zinc-800">設定</span>}</div></nav>
    </main>
  );
}

function GoalCard({ label, target, current, rateValue, remaining }: { label: string; target: string; current: string; rateValue: number; remaining: string }) {
  return <section className="mb-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-3xl font-bold">{target}</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-white" style={{ width: `${rateValue}%` }} /></div><div className="mt-3 flex justify-between text-xs text-zinc-500"><span>{current}</span><span>達成率 {rateValue}%</span></div><div className="mt-4 rounded-2xl bg-zinc-900 p-4"><p className="text-xs text-zinc-500">残り</p><p className="mt-1 text-xl font-bold">{remaining}</p></div></section>;
}

function StoreResultBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-zinc-900 p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}
