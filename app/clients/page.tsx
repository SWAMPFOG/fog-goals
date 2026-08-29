"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Profile = {
  role: string | null;
  member_id: string | null;
  team_id: string | null;
  department_id: string | null;
};

type Member = {
  id: string;
  name: string;
  team_id: string | null;
};

type ClientSale = {
  id: string;
  member_id: string;
  team_id: string;
  client_name: string;
  amount: number;
  visit_date: string;
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function yen(value: number) {
  return `¥${Number(value || 0).toLocaleString("ja-JP")}`;
}

export default function ClientsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sales, setSales] = useState<ClientSale[]>([]);
  const [month, setMonth] = useState(currentMonth());

  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [visitDate, setVisitDate] = useState(today());
  const [memberId, setMemberId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");

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

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role, member_id, team_id, department_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profileData) {
      setErrorMessage(profileError?.message ?? "プロフィールが見つかりません");
      setLoading(false);
      return;
    }

    const p = profileData as Profile;
    setProfile(p);

    const [year, monthNumber] = month.split("-").map(Number);
    const next = new Date(year, monthNumber, 1);
    const startDate = `${month}-01`;
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(
      2,
      "0"
    )}-01`;

    const { data: salesData, error: salesError } = await supabase
      .from("client_sales")
      .select("id, member_id, team_id, client_name, amount, visit_date")
      .gte("visit_date", startDate)
      .lt("visit_date", nextMonth)
      .order("visit_date", { ascending: false });

    if (salesError) {
      setErrorMessage(salesError.message);
      setLoading(false);
      return;
    }

    setSales((salesData ?? []) as ClientSale[]);

    const isCast = p.role === "cast" || p.role === "member";

    if (!isCast) {
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("id, name, team_id")
        .eq("is_active", true)
        .order("display_order");

      if (memberError) {
        setErrorMessage(memberError.message);
        setLoading(false);
        return;
      }

      const visibleMembers = (memberData ?? []) as Member[];
      setMembers(visibleMembers);

      if (!memberId && visibleMembers.length > 0) {
        setMemberId(visibleMembers[0].id);
      }
    } else {
      setMembers([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const isCast = profile?.role === "cast" || profile?.role === "member";

  const groupedClients = useMemo(() => {
    const map = new Map<
      string,
      {
        clientName: string;
        total: number;
        visits: number;
        latest: string;
      }
    >();

    for (const row of sales) {
      const key = row.client_name.trim();
      const current = map.get(key);

      if (!current) {
        map.set(key, {
          clientName: key,
          total: Number(row.amount ?? 0),
          visits: 1,
          latest: row.visit_date,
        });
      } else {
        current.total += Number(row.amount ?? 0);
        current.visits += 1;
        if (row.visit_date > current.latest) current.latest = row.visit_date;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [sales]);

  const totalSales = groupedClients.reduce((sum, row) => sum + row.total, 0);
  const clientCount = groupedClients.length;
  const average = clientCount > 0 ? Math.round(totalSales / clientCount) : 0;

  async function addSale() {
    if (!profile || isCast) return;

    const name = clientName.trim();
    const numericAmount = Number(amount || 0);

    if (!name) {
      setErrorMessage("クライアント名を入力してください");
      return;
    }

    if (!memberId) {
      setErrorMessage("担当キャストを選択してください");
      return;
    }

    if (!visitDate) {
      setErrorMessage("来店日を入力してください");
      return;
    }

    if (numericAmount < 0) {
      setErrorMessage("売上金額を確認してください");
      return;
    }

    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember?.team_id) {
      setErrorMessage("担当キャストのチームが見つかりません");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    const { error } = await supabase.from("client_sales").insert({
      member_id: memberId,
      team_id: targetMember.team_id,
      client_name: name,
      amount: numericAmount,
      visit_date: visitDate,
    });

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setClientName("");
    setAmount("");
    setVisitDate(today());
    setMessage("登録しました");
    setSaving(false);
    await load();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <Link href="/" className="text-sm text-zinc-500">
          ← ホーム
        </Link>

        <header className="mt-6 mb-6">
          <p className="text-xs tracking-[0.3em] text-zinc-500">SWAMP-FOG</p>
          <h1 className="mt-2 text-3xl font-bold">クライアント</h1>
          <p className="mt-1 text-sm text-zinc-500">CLIENT SALES</p>
        </header>

        <label className="block mb-4">
          <span className="text-xs text-zinc-500">対象月</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
          />
        </label>

        {errorMessage && (
          <section className="mb-4 rounded-2xl border border-red-900 p-4">
            <p className="text-sm text-red-400">ERROR: {errorMessage}</p>
          </section>
        )}

        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[11px] text-zinc-500">今月売上</p>
            <p className="mt-2 text-base font-bold">{yen(totalSales)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[11px] text-zinc-500">顧客数</p>
            <p className="mt-2 text-base font-bold">{clientCount}人</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[11px] text-zinc-500">客単価</p>
            <p className="mt-2 text-base font-bold">{yen(average)}</p>
          </div>
        </section>

        {!isCast && (
          <section className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs text-zinc-500">ADD SALES</p>
            <h2 className="mt-2 text-xl font-bold">売上を登録</h2>

            <div className="mt-5 space-y-3">
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="クライアント名"
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
              />

              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="売上金額"
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
              />

              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
              />

              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
              >
                <option value="">担当キャストを選択</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>

              <button
                onClick={addSale}
                disabled={saving}
                className="w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
              >
                {saving ? "登録中..." : "登録する"}
              </button>

              {message && (
                <p className="text-center text-sm text-green-400">{message}</p>
              )}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs text-zinc-500">THIS MONTH</p>
          <h2 className="mt-2 text-xl font-bold">クライアント別売上</h2>

          <div className="mt-5 space-y-2">
            {groupedClients.length === 0 ? (
              <p className="text-sm text-zinc-500">今月の売上登録はありません</p>
            ) : (
              groupedClients.map((client, index) => (
                <div
                  key={client.clientName}
                  className="rounded-2xl bg-zinc-900 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-zinc-600">{index + 1}位</p>
                      <p className="mt-1 font-bold">{client.clientName}</p>
                    </div>

                    <p className="font-bold">{yen(client.total)}</p>
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-zinc-500">
                    <span>来店 {client.visits}回</span>
                    <span>最終 {client.latest.replaceAll("-", "/")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}