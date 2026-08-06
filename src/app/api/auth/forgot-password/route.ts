import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const { success } = await rateLimit(`reset:${email}`, 3, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many reset requests. Try again later." },
      { status: 429 },
    );
  }

  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Always generic — don't reveal whether the email exists
  return NextResponse.json({
    ok: true,
    message: "If that email exists, a reset link has been sent.",
  });
}
