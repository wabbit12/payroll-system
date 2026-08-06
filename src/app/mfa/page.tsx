"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function friendlyMfaError(message: string, code?: string): string {
  const lower = message.toLowerCase();
  if (
    code === "mfa_totp_enroll_not_enabled" ||
    (lower.includes("enroll") && lower.includes("disabled")) ||
    lower.includes("unexpected failure")
  ) {
    return (
      "MFA/TOTP looks disabled or misconfigured in Supabase. " +
      "Go to Authentication → Multi-Factor (MFA) → enable TOTP " +
      "(Enroll and Verify), save, then click Retry."
    );
  }
  return message;
}

export default function MfaEnrollPage() {
  const router = useRouter();
  const started = useRef(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [alreadyEnabled, setAlreadyEnabled] = useState(false);

  const startEnroll = useCallback(async () => {
    setEnrolling(true);
    setError(null);
    setMessage(null);
    setQr(null);
    setSecret(null);
    setFactorId(null);
    setAlreadyEnabled(false);

    const supabase = createClient();

    const { data: factors, error: listError } =
      await supabase.auth.mfa.listFactors();
    if (listError) {
      setEnrolling(false);
      setError(friendlyMfaError(listError.message, listError.code));
      return;
    }

    const verified = factors.totp.find((f) => f.status === "verified");
    if (verified) {
      setEnrolling(false);
      setAlreadyEnabled(true);
      setMessage("MFA is already enabled on this account.");
      return;
    }

    // Remove every unfinished TOTP factor (name conflicts block re-enroll).
    for (const factor of factors.all) {
      if (factor.factor_type === "totp" && factor.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    // Unique name avoids "friendly name already exists" on retries / Strict Mode.
    const friendlyName = `Authenticator ${new Date().toISOString()}`;

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });

    setEnrolling(false);

    if (enrollError) {
      // One more cleanup pass, then retry once.
      if (enrollError.message.toLowerCase().includes("already exists")) {
        const again = await supabase.auth.mfa.listFactors();
        if (again.data) {
          for (const factor of again.data.all) {
            if (factor.factor_type === "totp" && factor.status !== "verified") {
              await supabase.auth.mfa.unenroll({ factorId: factor.id });
            }
          }
        }
        const retry = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Authenticator ${Date.now()}`,
        });
        if (retry.error) {
          setError(friendlyMfaError(retry.error.message, retry.error.code));
          return;
        }
        setFactorId(retry.data.id);
        setQr(retry.data.totp.qr_code);
        setSecret(retry.data.totp.secret);
        return;
      }

      setError(friendlyMfaError(enrollError.message, enrollError.code));
      return;
    }

    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void startEnroll();
  }, [startEnroll]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });

    setLoading(false);

    if (verifyError) {
      setError(friendlyMfaError(verifyError.message, verifyError.code));
      return;
    }

    setMessage("MFA enabled. You will need your authenticator on next sign-in.");
    setAlreadyEnabled(true);
    router.refresh();
  }

  async function removeUnverifiedAndRetry() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    if (data) {
      for (const factor of data.all) {
        if (factor.factor_type === "totp" && factor.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
    }
    await startEnroll();
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Set up MFA</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Required for admin roles. Scan the QR code with an authenticator app
        (Google Authenticator, 1Password, Authy).
      </p>

      {enrolling ? (
        <p className="mt-6 text-sm text-zinc-600">Generating QR code…</p>
      ) : null}

      {qr ? (
        <div className="mt-6 rounded-lg border border-zinc-200 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="MFA QR code" className="mx-auto h-48 w-48" />
          {secret ? (
            <p className="mt-3 break-all text-center text-xs text-zinc-500">
              Manual secret: {secret}
            </p>
          ) : null}
        </div>
      ) : null}

      {!alreadyEnabled ? (
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            6-digit code
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2"
              autoComplete="one-time-code"
              disabled={!factorId}
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading || !factorId}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Enable MFA"}
            </button>
            <button
              type="button"
              onClick={() => void removeUnverifiedAndRetry()}
              disabled={enrolling}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60"
            >
              Clear & retry
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 space-y-2">
          {message ? <p className="text-sm text-green-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </p>
    </main>
  );
}
