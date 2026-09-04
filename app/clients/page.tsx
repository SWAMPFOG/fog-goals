"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type VisitType =
  | "existing"
  | "inhouse"
  | "companion";

type Profile = {
  role: string | null;
  member_id: string | null;
  team_id: string | null;
  department_id: string | null;
  display_name: string | null;
};

type Member = {
  id: string;
  name: string;
  team_id: string | null;
};

type Client = {
  id: string;
  member_id: string;
  team_id: string;
  name: string;
};

type ClientSale = {
  id: string;
  client_id: string | null;
  member_id: string;
  team_id: string;
  client_name: string;
  amount: number;
  visit_date: string;
  visit_type: VisitType;
};

type ClientMustTarget = {
  id: string;
  client_id: string;
  target_month: string;
  must_sales: number;
};

type MemberGoal = {
  member_id: string;
  must_sales: number | null;
};

function currentMonth() {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

function today() {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function defaultDateForMonth(month: string) {
  const now = today();

  if (now.startsWith(month)) {
    return now;
  }

  return `${month}-01`;
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

function visitTypeLabel(
  value: VisitType
) {
  switch (value) {
    case "inhouse":
      return "場内";

    case "companion":
      return "新規（お連れ様）";

    default:
      return "既存";
  }
}

export default function ClientsPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [members, setMembers] =
    useState<Member[]>([]);

  const [clients, setClients] =
    useState<Client[]>([]);

  const [sales, setSales] =
    useState<ClientSale[]>([]);

  const [
    mustTargets,
    setMustTargets,
  ] =
    useState<
      ClientMustTarget[]
    >([]);

  const [
    memberGoals,
    setMemberGoals,
  ] =
    useState<MemberGoal[]>([]);

  const [month, setMonth] =
    useState(currentMonth());

  const [
    selectedMemberId,
    setSelectedMemberId,
  ] =
    useState<string | null>(
      null
    );

  const [
    selectedClientId,
    setSelectedClientId,
  ] =
    useState<string | null>(
      null
    );

  const [
    newClientName,
    setNewClientName,
  ] =
    useState("");

  const [
    saleAmount,
    setSaleAmount,
  ] =
    useState("");

  const [
    saleDate,
    setSaleDate,
  ] = useState(
    defaultDateForMonth(
      currentMonth()
    )
  );

  const [
    saleVisitType,
    setSaleVisitType,
  ] =
    useState<VisitType>(
      "existing"
    );

  const [
    clientMustInput,
    setClientMustInput,
  ] =
    useState("");

  const [
    editingSaleId,
    setEditingSaleId,
  ] =
    useState<string | null>(
      null
    );

  const [
    editAmount,
    setEditAmount,
  ] =
    useState("");

  const [
    editVisitDate,
    setEditVisitDate,
  ] =
    useState("");

  const [
    editVisitType,
    setEditVisitType,
  ] =
    useState<VisitType>(
      "existing"
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const isCast =
    profile?.role ===
      "cast" ||
    profile?.role ===
      "member";

  async function load(
    showLoader = true
  ) {
    if (showLoader) {
      setLoading(true);
    }

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
        "role, member_id, team_id, department_id, display_name"
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

      if (showLoader) {
        setLoading(false);
      }

      return;
    }

    const p =
      profileData as Profile;

    setProfile(p);

    const cast =
      p.role === "cast" ||
      p.role === "member";

    const [
      year,
      monthNumber,
    ] = month
      .split("-")
      .map(Number);

    const next =
      new Date(
        year,
        monthNumber,
        1
      );

    const startDate =
      `${month}-01`;

    const nextMonth =
      `${next.getFullYear()}-${String(
        next.getMonth() + 1
      ).padStart(2, "0")}-01`;

    const [
      salesResult,
      clientsResult,
      mustResult,
      goalsResult,
    ] = await Promise.all([
      supabase
        .from(
          "client_sales"
        )
        .select(
          "id, client_id, member_id, team_id, client_name, amount, visit_date, visit_type"
        )
        .gte(
          "visit_date",
          startDate
        )
        .lt(
          "visit_date",
          nextMonth
        )
        .order(
          "visit_date",
          {
            ascending:
              false,
          }
        ),

      supabase
        .from("clients")
        .select(
          "id, member_id, team_id, name"
        )
        .order("name"),

      supabase
        .from(
          "client_monthly_must_targets"
        )
        .select(
          "id, client_id, target_month, must_sales"
        )
        .eq(
          "target_month",
          startDate
        ),

      supabase
        .from(
          "monthly_goals"
        )
        .select(
          "member_id, must_sales"
        )
        .eq(
          "target_month",
          startDate
        ),
    ]);

    if (
      salesResult.error
    ) {
      setErrorMessage(
        salesResult.error
          .message
      );

      if (showLoader) {
        setLoading(false);
      }

      return;
    }

    if (
      clientsResult.error
    ) {
      setErrorMessage(
        clientsResult.error
          .message
      );

      if (showLoader) {
        setLoading(false);
      }

      return;
    }

    if (
      mustResult.error
    ) {
      setErrorMessage(
        mustResult.error
          .message
      );

      if (showLoader) {
        setLoading(false);
      }

      return;
    }

    if (
      goalsResult.error
    ) {
      setErrorMessage(
        goalsResult.error
          .message
      );

      if (showLoader) {
        setLoading(false);
      }

      return;
    }

    const loadedSales =
      (
        salesResult.data ??
        []
      ).map(
        (row: any) => ({
          ...row,

          visit_type:
            (row.visit_type ??
              "existing") as VisitType,
        })
      ) as ClientSale[];

    const loadedClients =
      (clientsResult.data ??
        []) as Client[];

    setSales(
      loadedSales
    );

    setClients(
      loadedClients
    );

    setMustTargets(
      (mustResult.data ??
        []) as ClientMustTarget[]
    );

    setMemberGoals(
      (goalsResult.data ??
        []) as MemberGoal[]
    );

    if (cast) {
      setMembers([]);

      setSelectedMemberId(
        p.member_id ??
          null
      );
    } else {
      const {
        data: memberData,
        error: memberError,
      } = await supabase
        .from("members")
        .select(
          "id, name, team_id"
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "display_order"
        );

      if (memberError) {
        setErrorMessage(
          memberError.message
        );

        if (showLoader) {
          setLoading(false);
        }

        return;
      }

      setMembers(
        (memberData ??
          []) as Member[]
      );
    }

    if (
      selectedClientId &&
      !loadedClients.some(
        (client) =>
          client.id ===
          selectedClientId
      )
    ) {
      setSelectedClientId(
        null
      );
    }

    if (showLoader) {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMessage("");

    setSaleDate(
      defaultDateForMonth(
        month
      )
    );

    setSaleVisitType(
      "existing"
    );

    setSelectedClientId(
      null
    );

    setClientMustInput(
      ""
    );

    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const activeMemberId =
    isCast
      ? profile?.member_id ??
        null
      : selectedMemberId;

  const selectedMemberName =
    isCast
      ? profile?.display_name ??
        "自分"
      : members.find(
          (member) =>
            member.id ===
            selectedMemberId
        )?.name ?? "";

  const memberSales =
    useMemo(() => {
      if (!activeMemberId) {
        return [];
      }

      return sales.filter(
        (row) =>
          row.member_id ===
          activeMemberId
      );
    }, [
      sales,
      activeMemberId,
    ]);

  const existingMemberSales =
    useMemo(() => {
      return memberSales.filter(
        (row) =>
          row.visit_type ===
          "existing"
      );
    }, [memberSales]);

  const monthClientCount =
    useMemo(() => {
      const ids =
        new Set(
          existingMemberSales
            .map(
              (row) =>
                row.client_id
            )
            .filter(
              (
                id
              ): id is string =>
                !!id
            )
        );

      return ids.size;
    }, [
      existingMemberSales,
    ]);

  const memberTotalSales =
    useMemo(() => {
      return memberSales.reduce(
        (sum, row) =>
          sum +
          Number(
            row.amount ?? 0
          ),
        0
      );
    }, [memberSales]);

  const averageClientSales =
    monthClientCount > 0
      ? Math.round(
          memberTotalSales /
            monthClientCount
        )
      : 0;

  const individualMustSales =
    Number(
      memberGoals.find(
        (row) =>
          row.member_id ===
          activeMemberId
      )?.must_sales ?? 0
    );

  const memberClients =
    useMemo(() => {
      if (!activeMemberId) {
        return [];
      }

      return clients
        .filter(
          (client) =>
            client.member_id ===
            activeMemberId
        )
        .map((client) => {
          const rows =
            memberSales.filter(
              (row) =>
                row.client_id ===
                client.id
            );

          const existingRows =
            rows.filter(
              (row) =>
                row.visit_type ===
                "existing"
            );

          const total =
            rows.reduce(
              (sum, row) =>
                sum +
                Number(
                  row.amount ??
                    0
                ),
              0
            );

          const latest =
            rows.length > 0
              ? rows
                  .map(
                    (row) =>
                      row.visit_date
                  )
                  .sort()
                  .reverse()[0]
              : null;

          const mustTarget =
            mustTargets.find(
              (row) =>
                row.client_id ===
                client.id
            );

          const mustSales =
            Number(
              mustTarget?.must_sales ??
                0
            );

          return {
            ...client,

            total,

            visits:
              rows.length,

            existingVisits:
              existingRows.length,

            countsAsClient:
              existingRows.length >
              0,

            latest,

            mustSales,

            mustRate:
              percent(
                total,
                mustSales
              ),

            mustRemaining:
              Math.max(
                0,
                mustSales -
                  total
              ),

            mustOver:
              Math.max(
                0,
                total -
                  mustSales
              ),
          };
        })
        .sort(
          (a, b) => {
            if (
              b.total !==
              a.total
            ) {
              return (
                b.total -
                a.total
              );
            }

            if (
              a.latest &&
              !b.latest
            ) {
              return -1;
            }

            if (
              !a.latest &&
              b.latest
            ) {
              return 1;
            }

            return a.name.localeCompare(
              b.name,
              "ja"
            );
          }
        );
    }, [
      clients,
      memberSales,
      activeMemberId,
      mustTargets,
    ]);

  const assignedMustSales =
    memberClients.reduce(
      (sum, client) =>
        sum +
        Number(
          client.mustSales ??
            0
        ),
      0
    );

  const unassignedMustSales =
    Math.max(
      0,
      individualMustSales -
        assignedMustSales
    );

  const overAssignedMustSales =
    Math.max(
      0,
      assignedMustSales -
        individualMustSales
    );

  const memberSummaries =
    useMemo(() => {
      return members
        .map((member) => {
          const rows =
            sales.filter(
              (row) =>
                row.member_id ===
                member.id
            );

          const total =
            rows.reduce(
              (sum, row) =>
                sum +
                Number(
                  row.amount ??
                    0
                ),
              0
            );

          const clientIds =
            new Set(
              rows
                .filter(
                  (row) =>
                    row.visit_type ===
                    "existing"
                )
                .map(
                  (row) =>
                    row.client_id
                )
                .filter(
                  (
                    id
                  ): id is string =>
                    !!id
                )
            );

          return {
            ...member,

            total,

            clientCount:
              clientIds.size,
          };
        })
        .sort(
          (a, b) =>
            b.total -
            a.total
        );
    }, [
      members,
      sales,
    ]);

  const selectedClient =
    useMemo(() => {
      return (
        clients.find(
          (client) =>
            client.id ===
            selectedClientId
        ) ?? null
      );
    }, [
      clients,
      selectedClientId,
    ]);

  const selectedClientSales =
    useMemo(() => {
      if (!selectedClient) {
        return [];
      }

      return sales.filter(
        (row) =>
          row.client_id ===
          selectedClient.id
      );
    }, [
      sales,
      selectedClient,
    ]);

  const selectedClientTotal =
    selectedClientSales.reduce(
      (sum, row) =>
        sum +
        Number(
          row.amount ?? 0
        ),
      0
    );

  const selectedClientVisits =
    selectedClientSales.length;

  const selectedExistingVisits =
    selectedClientSales.filter(
      (row) =>
        row.visit_type ===
        "existing"
    ).length;

  const selectedInhouseVisits =
    selectedClientSales.filter(
      (row) =>
        row.visit_type ===
        "inhouse"
    ).length;

  const selectedCompanionVisits =
    selectedClientSales.filter(
      (row) =>
        row.visit_type ===
        "companion"
    ).length;

  const selectedClientLatest =
    selectedClientSales.length >
    0
      ? selectedClientSales
          .map(
            (row) =>
              row.visit_date
          )
          .sort()
          .reverse()[0]
      : null;

  const selectedMustTarget =
    selectedClient
      ? mustTargets.find(
          (row) =>
            row.client_id ===
            selectedClient.id
        ) ?? null
      : null;

  const selectedMustSales =
    Number(
      selectedMustTarget?.must_sales ??
        0
    );

  const selectedMustRate =
    percent(
      selectedClientTotal,
      selectedMustSales
    );

  const selectedMustRemaining =
    Math.max(
      0,
      selectedMustSales -
        selectedClientTotal
    );

  const selectedMustOver =
    Math.max(
      0,
      selectedClientTotal -
        selectedMustSales
    );

  useEffect(() => {
    if (selectedClientId) {
      setClientMustInput(
        selectedMustSales > 0
          ? String(
              selectedMustSales
            )
          : ""
      );
    }
  }, [
    selectedClientId,
    selectedMustSales,
  ]);

  async function addClient() {
    if (
      !profile ||
      isCast ||
      !activeMemberId
    ) {
      return;
    }

    const name =
      newClientName.trim();

    if (!name) {
      setErrorMessage(
        "クライアント名を入力してください"
      );

      return;
    }

    const duplicate =
      clients.find(
        (client) =>
          client.member_id ===
            activeMemberId &&
          client.name
            .trim()
            .toLowerCase() ===
            name.toLowerCase()
      );

    if (duplicate) {
      setSelectedClientId(
        duplicate.id
      );

      setNewClientName(
        ""
      );

      setMessage(
        "登録済みのクライアントを開きました"
      );

      return;
    }

    const targetMember =
      members.find(
        (member) =>
          member.id ===
          activeMemberId
      );

    if (
      !targetMember?.team_id
    ) {
      setErrorMessage(
        "担当キャストのチームが見つかりません"
      );

      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    const {
      data,
      error,
    } = await supabase
      .from("clients")
      .insert({
        member_id:
          activeMemberId,

        team_id:
          targetMember.team_id,

        name,
      })
      .select(
        "id, member_id, team_id, name"
      )
      .single();

    if (error) {
      setErrorMessage(
        error.message
      );

      setSaving(false);

      return;
    }

    setNewClientName(
      ""
    );

    if (data?.id) {
      setSelectedClientId(
        data.id
      );
    }

    await load(false);

    setMessage(
      "クライアントを登録しました"
    );

    setSaving(false);
  }

  async function saveClientMust() {
    if (
      !selectedClient ||
      isCast
    ) {
      return;
    }

    const numericValue =
      Number(
        clientMustInput ||
          0
      );

    if (
      !Number.isFinite(
        numericValue
      ) ||
      numericValue < 0
    ) {
      setErrorMessage(
        "必達金額を確認してください"
      );

      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    if (
      numericValue ===
      0
    ) {
      if (
        selectedMustTarget
      ) {
        const {
          error,
        } = await supabase
          .from(
            "client_monthly_must_targets"
          )
          .delete()
          .eq(
            "id",
            selectedMustTarget.id
          );

        if (error) {
          setErrorMessage(
            error.message
          );

          setSaving(false);

          return;
        }
      }

      setClientMustInput(
        ""
      );

      await load(false);

      setMessage(
        "クライアント必達を解除しました"
      );

      setSaving(false);

      return;
    }

    const {
      error,
    } = await supabase
      .from(
        "client_monthly_must_targets"
      )
      .upsert(
        {
          client_id:
            selectedClient.id,

          target_month:
            `${month}-01`,

          must_sales:
            numericValue,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "client_id,target_month",
        }
      );

    if (error) {
      setErrorMessage(
        error.message
      );

      setSaving(false);

      return;
    }

    await load(false);

    setMessage(
      "クライアント必達を保存しました"
    );

    setSaving(false);
  }

  async function addSale() {
    if (
      !profile ||
      isCast ||
      !selectedClient
    ) {
      return;
    }

    const numericAmount =
      Number(
        saleAmount || 0
      );

    if (!saleDate) {
      setErrorMessage(
        "来店日を入力してください"
      );

      return;
    }

    if (
      !saleDate.startsWith(
        month
      )
    ) {
      setErrorMessage(
        "対象月の日付を入力してください"
      );

      return;
    }

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount < 0
    ) {
      setErrorMessage(
        "売上金額を確認してください"
      );

      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    const {
      error,
    } = await supabase
      .from(
        "client_sales"
      )
      .insert({
        client_id:
          selectedClient.id,

        member_id:
          selectedClient.member_id,

        team_id:
          selectedClient.team_id,

        client_name:
          selectedClient.name,

        amount:
          numericAmount,

        visit_date:
          saleDate,

        visit_type:
          saleVisitType,
      });

    if (error) {
      setErrorMessage(
        error.message
      );

      setSaving(false);

      return;
    }

    setSaleAmount(
      ""
    );

    setSaleVisitType(
      "existing"
    );

    await load(false);

    setMessage(
      "売上を追加しました"
    );

    setSaving(false);
  }

  function startEdit(
    row: ClientSale
  ) {
    setEditingSaleId(
      row.id
    );

    setEditAmount(
      String(
        row.amount ?? 0
      )
    );

    setEditVisitDate(
      row.visit_date
    );

    setEditVisitType(
      row.visit_type ??
        "existing"
    );

    setErrorMessage(
      ""
    );
  }

  function cancelEdit() {
    setEditingSaleId(
      null
    );
  }

  async function saveEdit(
    row: ClientSale
  ) {
    if (
      !profile ||
      isCast
    ) {
      return;
    }

    const numericAmount =
      Number(
        editAmount || 0
      );

    if (
      !editVisitDate ||
      !editVisitDate.startsWith(
        month
      )
    ) {
      setErrorMessage(
        "対象月の日付を入力してください"
      );

      return;
    }

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount < 0
    ) {
      setErrorMessage(
        "売上金額を確認してください"
      );

      return;
    }

    setSaving(true);
    setErrorMessage("");

    const {
      error,
    } = await supabase
      .from(
        "client_sales"
      )
      .update({
        amount:
          numericAmount,

        visit_date:
          editVisitDate,

        visit_type:
          editVisitType,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        row.id
      );

    if (error) {
      setErrorMessage(
        error.message
      );

      setSaving(false);

      return;
    }

    setEditingSaleId(
      null
    );

    await load(false);

    setMessage(
      "修正しました"
    );

    setSaving(false);
  }

  async function deleteSale(
    row: ClientSale
  ) {
    if (
      !profile ||
      isCast
    ) {
      return;
    }

    const ok =
      window.confirm(
        `${row.visit_date} の ${yen(
          row.amount
        )} を削除しますか？`
      );

    if (!ok) {
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const {
      error,
    } = await supabase
      .from(
        "client_sales"
      )
      .delete()
      .eq(
        "id",
        row.id
      );

    if (error) {
      setErrorMessage(
        error.message
      );

      setSaving(false);

      return;
    }

    await load(false);

    setMessage(
      "削除しました"
    );

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

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <Link
          href="/"
          className="text-sm text-zinc-500"
        >
          ← ホーム
        </Link>

        <header className="mt-6 mb-6">
          <p className="text-xs tracking-[0.3em] text-zinc-500">
            SWAMP-FOG
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            クライアント
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            CLIENT MANAGEMENT
          </p>
        </header>

        <label className="block mb-4">
          <span className="text-xs text-zinc-500">
            対象月
          </span>

          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(
                e.target.value
              );

              setEditingSaleId(
                null
              );
            }}
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

        {message && (
          <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-sm text-green-400">
              {message}
            </p>
          </section>
        )}

        {!isCast &&
          !selectedMemberId && (
            <section>
              <p className="text-xs text-zinc-500">
                CAST
              </p>

              <h2 className="mt-2 text-xl font-bold">
                キャストを選択
              </h2>

              <div className="mt-4 space-y-2">
                {memberSummaries.map(
                  (member) => (
                    <button
                      key={
                        member.id
                      }
                      onClick={() => {
                        setSelectedMemberId(
                          member.id
                        );

                        setSelectedClientId(
                          null
                        );

                        setEditingSaleId(
                          null
                        );

                        setMessage(
                          ""
                        );
                      }}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold">
                            {
                              member.name
                            }
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            今月顧客{" "}
                            {
                              member.clientCount
                            }
                            人
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-bold">
                            {yen(
                              member.total
                            )}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            →
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                )}
              </div>
            </section>
          )}

        {activeMemberId &&
          !selectedClientId && (
            <>
              {!isCast && (
                <button
                  onClick={() => {
                    setSelectedMemberId(
                      null
                    );

                    setSelectedClientId(
                      null
                    );

                    setMessage(
                      ""
                    );
                  }}
                  className="mb-4 text-sm text-zinc-500"
                >
                  ← キャスト一覧
                </button>
              )}

              <section>
                <p className="text-xs text-zinc-500">
                  CLIENTS
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {selectedMemberName}
                  のクライアント
                </h2>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <SummaryBox
                    label="今月売上"
                    value={yen(
                      memberTotalSales
                    )}
                  />

                  <SummaryBox
                    label="今月顧客"
                    value={`${monthClientCount}人`}
                  />

                  <SummaryBox
                    label="客単価"
                    value={yen(
                      averageClientSales
                    )}
                  />
                </div>

                <p className="mt-2 text-xs text-zinc-600">
                  ※ 顧客数は「既存」のみ。場内・新規お連れ様は含みません。
                </p>
              </section>

              <section className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
                <p className="text-xs text-zinc-500">
                  MUST SALES
                </p>

                <div className="mt-2">
                  <p className="text-sm text-zinc-400">
                    個人必達
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {individualMustSales >
                    0
                      ? yen(
                          individualMustSales
                        )
                      : "未設定"}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <SummaryBox
                    label="配分済み"
                    value={yen(
                      assignedMustSales
                    )}
                  />

                  <SummaryBox
                    label={
                      overAssignedMustSales >
                      0
                        ? "配分超過"
                        : "未配分"
                    }
                    value={
                      individualMustSales >
                      0
                        ? overAssignedMustSales >
                          0
                          ? `+${yen(
                              overAssignedMustSales
                            )}`
                          : yen(
                              unassignedMustSales
                            )
                        : "－"
                    }
                  />
                </div>

                <p className="mt-3 text-xs text-zinc-600">
                  ※ 必達には既存・場内・新規お連れ様の売上すべてを含みます。
                </p>
              </section>

              {!isCast && (
                <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
                  <p className="text-xs text-zinc-500">
                    NEW CLIENT
                  </p>

                  <h2 className="mt-2 text-xl font-bold">
                    クライアント追加
                  </h2>

                  <div className="mt-4 flex gap-2">
                    <input
                      value={
                        newClientName
                      }
                      onChange={(e) =>
                        setNewClientName(
                          e.target.value
                        )
                      }
                      placeholder="クライアント名"
                      className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    />

                    <button
                      onClick={
                        addClient
                      }
                      disabled={
                        saving
                      }
                      className="rounded-2xl bg-white px-5 font-bold text-black disabled:opacity-50"
                    >
                      追加
                    </button>
                  </div>
                </section>
              )}

              <section className="mt-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-zinc-500">
                      CLIENT LIST
                    </p>

                    <h2 className="mt-2 text-xl font-bold">
                      クライアント一覧
                    </h2>
                  </div>

                  <p className="text-xs text-zinc-500">
                    登録{" "}
                    {
                      memberClients.length
                    }
                    人
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  {memberClients.length ===
                  0 ? (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                      <p className="text-sm text-zinc-500">
                        クライアント登録はありません
                      </p>
                    </div>
                  ) : (
                    memberClients.map(
                      (client) => (
                        <button
                          key={
                            client.id
                          }
                          onClick={() => {
                            setSelectedClientId(
                              client.id
                            );

                            setEditingSaleId(
                              null
                            );

                            setMessage(
                              ""
                            );
                          }}
                          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-bold">
                                {
                                  client.name
                                }
                              </p>

                              {client.visits >
                              0 ? (
                                <p className="mt-1 text-xs text-zinc-500">
                                  来店{" "}
                                  {
                                    client.visits
                                  }
                                  回 ・ 最終{" "}
                                  {client.latest?.replaceAll(
                                    "-",
                                    "/"
                                  )}
                                </p>
                              ) : (
                                <p className="mt-1 text-xs text-zinc-600">
                                  今月未来店
                                </p>
                              )}

                              {client.visits >
                                0 && (
                                <p className="mt-1 text-xs text-zinc-600">
                                  {client.countsAsClient
                                    ? "顧客数対象"
                                    : "顧客数対象外"}
                                </p>
                              )}

                              {client.mustSales >
                                0 && (
                                <p className="mt-2 text-xs text-zinc-400">
                                  必達{" "}
                                  {yen(
                                    client.mustSales
                                  )}
                                  {" ・ "}
                                  {
                                    client.mustRate
                                  }
                                  %
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="font-bold">
                                {yen(
                                  client.total
                                )}
                              </p>

                              {client.mustSales >
                                0 && (
                                <p className="mt-1 text-xs text-zinc-500">
                                  {client.mustOver >
                                  0
                                    ? `+${yen(
                                        client.mustOver
                                      )}`
                                    : `残り ${yen(
                                        client.mustRemaining
                                      )}`}
                                </p>
                              )}

                              <p className="mt-1 text-xs text-zinc-500">
                                →
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    )
                  )}
                </div>
              </section>
            </>
          )}

        {selectedClient && (
          <>
            <button
              onClick={() => {
                setSelectedClientId(
                  null
                );

                setEditingSaleId(
                  null
                );

                setMessage(
                  ""
                );
              }}
              className="mb-4 text-sm text-zinc-500"
            >
              ← クライアント一覧
            </button>

            <section>
              <p className="text-xs text-zinc-500">
                CLIENT
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                {
                  selectedClient.name
                }
              </h2>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <SummaryBox
                  label="今月売上"
                  value={yen(
                    selectedClientTotal
                  )}
                />

                <SummaryBox
                  label="来店"
                  value={`${selectedClientVisits}回`}
                />

                <SummaryBox
                  label="最終来店"
                  value={
                    selectedClientLatest
                      ? selectedClientLatest
                          .slice(5)
                          .replace(
                            "-",
                            "/"
                          )
                      : "－"
                  }
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <SmallBox
                  label="既存"
                  value={`${selectedExistingVisits}回`}
                />

                <SmallBox
                  label="場内"
                  value={`${selectedInhouseVisits}回`}
                />

                <SmallBox
                  label="お連れ様"
                  value={`${selectedCompanionVisits}回`}
                />
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-zinc-700 bg-zinc-950 p-5">
              <p className="text-xs text-zinc-500">
                CLIENT MUST
              </p>

              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-400">
                    クライアント必達
                  </p>

                  <p className="mt-1 text-3xl font-bold">
                    {selectedMustSales >
                    0
                      ? yen(
                          selectedMustSales
                        )
                      : "未設定"}
                  </p>
                </div>

                <p className="text-2xl font-bold">
                  {selectedMustSales >
                  0
                    ? `${selectedMustRate}%`
                    : "－"}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <SummaryBox
                  label="現在"
                  value={yen(
                    selectedClientTotal
                  )}
                />

                <SummaryBox
                  label={
                    selectedMustOver >
                    0
                      ? "必達超過"
                      : "残り"
                  }
                  value={
                    selectedMustSales <=
                    0
                      ? "－"
                      : selectedMustOver >
                          0
                        ? `+${yen(
                            selectedMustOver
                          )}`
                        : yen(
                            selectedMustRemaining
                          )
                  }
                />
              </div>

              <p className="mt-3 text-xs text-zinc-600">
                必達実績には来店種別を問わず、すべての売上を含みます。
              </p>

              {!isCast && (
                <div className="mt-5 border-t border-zinc-800 pt-5">
                  <label className="block">
                    <span className="text-xs text-zinc-500">
                      このクライアントの必達
                    </span>

                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={
                        clientMustInput
                      }
                      onChange={(e) =>
                        setClientMustInput(
                          e.target.value
                        )
                      }
                      placeholder="300000"
                      className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    />
                  </label>

                  <p className="mt-2 text-xs text-zinc-600">
                    0で必達解除
                  </p>

                  <button
                    onClick={
                      saveClientMust
                    }
                    disabled={
                      saving
                    }
                    className="mt-4 w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
                  >
                    {saving
                      ? "保存中..."
                      : "必達を保存"}
                  </button>
                </div>
              )}
            </section>

            {!isCast && (
              <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
                <p className="text-xs text-zinc-500">
                  ADD SALES
                </p>

                <h2 className="mt-2 text-xl font-bold">
                  売上追加
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  日付・金額・来店種別
                </p>

                <div className="mt-5 space-y-3">
                  <input
                    type="date"
                    value={
                      saleDate
                    }
                    onChange={(e) =>
                      setSaleDate(
                        e.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
                  />

                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={
                      saleAmount
                    }
                    onChange={(e) =>
                      setSaleAmount(
                        e.target.value
                      )
                    }
                    placeholder="売上金額"
                    className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
                  />

                  <label className="block">
                    <span className="text-xs text-zinc-500">
                      来店種別
                    </span>

                    <select
                      value={
                        saleVisitType
                      }
                      onChange={(e) =>
                        setSaleVisitType(
                          e.target
                            .value as VisitType
                        )
                      }
                      className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white"
                    >
                      <option value="existing">
                        既存
                      </option>

                      <option value="inhouse">
                        場内
                      </option>

                      <option value="companion">
                        新規（お連れ様）
                      </option>
                    </select>
                  </label>

                  <p className="text-xs leading-5 text-zinc-600">
                    「既存」だけ顧客数にカウント。
                    場内・新規お連れ様も売上と必達には含まれます。
                  </p>

                  <button
                    onClick={
                      addSale
                    }
                    disabled={
                      saving
                    }
                    className="w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
                  >
                    {saving
                      ? "保存中..."
                      : "追加する"}
                  </button>
                </div>
              </section>
            )}

            <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs text-zinc-500">
                HISTORY
              </p>

              <h2 className="mt-2 text-xl font-bold">
                売上履歴
              </h2>

              <div className="mt-5 space-y-3">
                {selectedClientSales.length ===
                0 ? (
                  <p className="text-sm text-zinc-500">
                    この月の来店はありません
                  </p>
                ) : (
                  selectedClientSales.map(
                    (row) => (
                      <div
                        key={
                          row.id
                        }
                        className="rounded-2xl bg-zinc-900 p-4"
                      >
                        {editingSaleId ===
                        row.id ? (
                          <div className="space-y-3">
                            <input
                              type="date"
                              value={
                                editVisitDate
                              }
                              onChange={(e) =>
                                setEditVisitDate(
                                  e.target.value
                                )
                              }
                              className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-3"
                            />

                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={
                                editAmount
                              }
                              onChange={(e) =>
                                setEditAmount(
                                  e.target.value
                                )
                              }
                              className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-3"
                            />

                            <select
                              value={
                                editVisitType
                              }
                              onChange={(e) =>
                                setEditVisitType(
                                  e.target
                                    .value as VisitType
                                )
                              }
                              className="w-full rounded-xl border border-zinc-700 bg-black px-3 py-3"
                            >
                              <option value="existing">
                                既存
                              </option>

                              <option value="inhouse">
                                場内
                              </option>

                              <option value="companion">
                                新規（お連れ様）
                              </option>
                            </select>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={
                                  cancelEdit
                                }
                                className="rounded-xl border border-zinc-700 py-2"
                              >
                                キャンセル
                              </button>

                              <button
                                onClick={() =>
                                  saveEdit(
                                    row
                                  )
                                }
                                disabled={
                                  saving
                                }
                                className="rounded-xl bg-white py-2 font-bold text-black disabled:opacity-50"
                              >
                                保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-bold">
                                  {row.visit_date.replaceAll(
                                    "-",
                                    "/"
                                  )}
                                </p>

                                <p className="mt-1 text-xs text-zinc-500">
                                  {visitTypeLabel(
                                    row.visit_type
                                  )}
                                </p>
                              </div>

                              <p className="text-xl font-bold">
                                {yen(
                                  row.amount
                                )}
                              </p>
                            </div>

                            {!isCast && (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  onClick={() =>
                                    startEdit(
                                      row
                                    )
                                  }
                                  className="rounded-xl border border-zinc-700 py-2"
                                >
                                  編集
                                </button>

                                <button
                                  onClick={() =>
                                    deleteSale(
                                      row
                                    )
                                  }
                                  className="rounded-xl border border-red-900 py-2 text-red-400"
                                >
                                  削除
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  )
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-[11px] text-zinc-500">
        {label}
      </p>

      <p className="mt-2 break-words text-base font-bold">
        {value}
      </p>
    </div>
  );
}

function SmallBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-900 p-3 text-center">
      <p className="text-[10px] text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold">
        {value}
      </p>
    </div>
  );
}