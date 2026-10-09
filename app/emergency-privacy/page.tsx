"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PrivacyImpactCounts } from "@/utils/privacy/impact";

type View = "loading" | "denied" | "ready" | "error";

export default function PrivacyImpactPage() {
  const [view, setView] = useState<View>("loading");
  const [counts, setCounts] = useState<PrivacyImpactCounts | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const response = await fetch("/api/privacy-impact", { cache: "no-store", credentials: "same-origin" });
        if (!alive) return;
        if (response.status === 401 || response.status === 403) {
          setView("denied");
          return;
        }
        if (!response.ok) throw new Error("Unable to load impact preview");
        const impact: { counts: PrivacyImpactCounts } = await response.json();
        if (!alive) return;
        setCounts(impact.counts);
        setView("ready");
      } catch {
        if (alive) setView("error");
      }
    };
    void run();
    return () => { alive = false; };
  }, []);

  const impact = counts ? { clientTargetsRequireReview: counts.clientTargetRows > 0 } : null;

  return <main className="mx-auto w-full max-w-xl space-y-5 p-6">
    <Link href="/" className="underline">← ホーム</Link>
    <h1 className="text-2xl font-bold">緊急情報保護：影響確認</h1>
    <p>読み取り専用の確認画面です。データの変更・削除は行いません。</p>
    {view === "loading" && <p>権限と対象件数を確認しています…</p>}
    {view === "denied" && <p role="alert">閲覧権限がありません。</p>}
    {view === "error" && <p role="alert">件数を取得できませんでした。アクセス権限や通信状態をご確認ください。</p>}
    {view === "ready" && impact && <section className="space-y-3 rounded-lg border border-red-700 p-5">
      <h2 className="font-semibold">確認できた対象件数</h2>
      <dl className="space-y-2">
        <div className="flex justify-between"><dt>顧客別売上履歴</dt><dd>{counts?.clientSalesRows}件</dd></div>
        <div className="flex justify-between"><dt>顧客台帳</dt><dd>{counts?.clientRows}件</dd></div>
        <div className="flex justify-between"><dt>売上のある日報</dt><dd>{counts?.dailyRowsWithSales}件</dd></div>
        <div className="flex justify-between"><dt>顧客別必達目標（関連データ）</dt><dd>{counts?.clientTargetRows}件</dd></div>
      </dl>
      <p className="text-sm">上記はログイン中のアカウントに閲覧が許可された範囲の件数です。店舗全体の件数を保証するものではありません。</p>
      {impact.clientTargetsRequireReview && <p className="text-sm font-semibold text-red-600">顧客別必達目標との関連があります。削除方式の追加検証が必要です。</p>}
      <button disabled type="button" className="w-full cursor-not-allowed rounded bg-red-900 p-3 text-white opacity-60">緊急情報消去（未実装）</button>
    </section>}
  </main>;
}
