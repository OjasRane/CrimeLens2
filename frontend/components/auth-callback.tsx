"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, CircleDashed, TriangleAlert } from "lucide-react";
import { navigateAccountBoundary } from "@/lib/account-navigation";
import { loadAuthorizedProfile } from "@/lib/crimelens-auth";
import { safeReturnPath } from "@/lib/public-access";
import {
  getSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase-browser";

type CallbackState = "working" | "success" | "error";

export function AuthCallback() {
  const [state, setState] = useState<CallbackState>("working");
  const [message, setMessage] = useState("Verifying your secure session…");

  useEffect(() => {
    let active = true;

    const finishSignIn = async () => {
      const search = new URLSearchParams(window.location.search);
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const destination = safeReturnPath(search.get("next"), "/cases/new");

      if (search.has("error") || fragment.has("error")) {
        if (!active) return;
        setState("error");
        setMessage("Sign-in was cancelled or the authentication link expired.");
        return;
      }

      if (!isSupabaseBrowserConfigured) {
        setState("error");
        setMessage("Supabase Auth is not configured for this deployment.");
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          throw error ?? new Error("No authenticated user was returned");
        }

        setMessage("Identity confirmed. Loading your case access…");
        await loadAuthorizedProfile(supabase, data.user.id, true);
        if (!active) return;

        setState("success");
        setMessage("Access confirmed. Opening CrimeLens…");
        navigateAccountBoundary(destination);
      } catch (cause) {
        if (!active) return;
        const marker = cause instanceof Error ? cause.message : "";
        setState("error");
        setMessage(
          marker === "AUTHORIZED_PROFILE_INACTIVE"
            ? "This CrimeLens account is inactive. Contact the administrator."
            : marker === "PUBLIC_ONBOARDING_NOT_DEPLOYED"
              ? "Google verified your identity, but the CrimeLens onboarding migration is not deployed in Supabase."
              : marker === "PUBLIC_ONBOARDING_NOT_ELIGIBLE"
                ? "Google verified your identity, but this existing account does not yet have a CrimeLens profile."
            : "Your identity was verified, but CrimeLens could not finish account access. Retry sign-in or contact the administrator.",
        );
      }
    };

    void finishSignIn();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="login-terminal flex min-h-dvh items-center justify-center bg-[var(--paper)] px-4 py-10 font-mono uppercase tracking-[0.12em] text-[var(--ink)]">
      <section
        className="w-full max-w-xl border-4 border-[var(--line)] bg-[var(--panel)] p-7 shadow-[8px_8px_0_var(--ink)] sm:p-10"
        aria-live="polite"
      >
        <p className="text-[9px] font-black opacity-65">AUTH // CALLBACK</p>
        <div className="mt-7 flex items-center gap-4">
          {state === "working" ? (
            <CircleDashed className="h-9 w-9 animate-spin" aria-hidden="true" />
          ) : state === "success" ? (
            <Check className="h-9 w-9" aria-hidden="true" />
          ) : (
            <TriangleAlert className="h-9 w-9 text-[#D22B2B]" aria-hidden="true" />
          )}
          <h1 className="font-serif text-3xl font-black tracking-[-0.03em] sm:text-5xl">
            {state === "error" ? "SIGN-IN INTERRUPTED" : "VERIFYING ACCESS"}
          </h1>
        </div>
        <p className="mt-7 text-[10px] font-bold leading-6">{message}</p>
        {state === "error" ? (
          <Link
            href="/#signup"
            className="mt-7 flex min-h-12 items-center justify-center border-2 border-[var(--line)] bg-[var(--accent)] px-4 py-3 text-xs font-black text-[var(--accent-ink)] shadow-[4px_4px_0_var(--ink)]"
          >
            RETURN TO SIGN-IN
          </Link>
        ) : null}
      </section>
    </main>
  );
}
