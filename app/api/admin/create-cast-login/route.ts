import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !publishable || !secret) {
      return NextResponse.json(
        { error: "サーバー設定が不足しています" },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json({ error: "未ログインです" }, { status: 401 });
    }

    const { memberId, email } = await req.json();

    if (!memberId || !email) {
      return NextResponse.json(
        { error: "memberId と email が必要です" },
        { status: 400 }
      );
    }

    const userClient = createClient(url, publishable, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
    }

    const admin = createClient(url, secret, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, team_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "権限情報を取得できません" },
        { status: 403 }
      );
    }

    const allowedRoles = [
      "team_manager",
      "business_manager",
      "company_manager",
      "chairman",
    ];

    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: "発行権限がありません" }, { status: 403 });
    }

    const { data: member, error: memberError } = await admin
      .from("members")
      .select("id, name, team_id")
      .eq("id", memberId)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "メンバーが見つかりません" },
        { status: 404 }
      );
    }

    if (
      profile.role === "team_manager" &&
      profile.team_id !== member.team_id
    ) {
      return NextResponse.json(
        { error: "自チーム以外には発行できません" },
        { status: 403 }
      );
    }

    const password =
      "Fog!" + crypto.randomUUID().replaceAll("-", "").slice(0, 10);

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        password,
        email_confirm: true,
      });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message ?? "Auth作成に失敗しました" },
        { status: 400 }
      );
    }

    const { error: profileInsertError } = await admin.from("profiles").upsert({
      id: created.user.id,
      role: "cast",
      team_id: member.team_id,
      department_id: null,
      member_id: member.id,
      display_name: member.name,
    });

    if (profileInsertError) {
      await admin.auth.admin.deleteUser(created.user.id);

      return NextResponse.json(
        { error: profileInsertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      email: String(email).trim().toLowerCase(),
      password,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "発行に失敗しました" },
      { status: 500 }
    );
  }
}
