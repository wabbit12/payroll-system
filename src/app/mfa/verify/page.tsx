"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaVerifyPage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFactor() {
      const supabase = createClient();
      const { data, error: listError } =
        await supabase.auth.mfa.listFactors();
      if (cancelled) return;

      if (listError) {
        setError(listError.message);
        return;
      }

      const totp = data.totp.find((f) => f.status === "verified");
      if (!totp) {
        setError("No MFA factor found. Enroll MFA first.");
        return;
      }
      setFactorId(totp.id);
    }

    void loadFactor();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Authenticator code
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Enter the 6-digit code from your authenticator app.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Code
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
            autoComplete="one-time-code"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !factorId}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
