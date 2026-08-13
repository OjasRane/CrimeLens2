"use client";

import type { FormEvent } from "react";
import {
  Check,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  browserSupportsPasskeys,
  buildEnrollmentRedirectUrl,
  classifyEnrollmentError,
  classifyPasskeyError,
  loadAuthorizedProfile,
  type CrimeLensProfile,
} from "@/lib/crimelens-auth";
import {
  getSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase-browser";

type PasskeyRecord = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

type SecurityTerminalProps = {
  onboarding?: boolean;
};

const panel =
  "border-4 border-black bg-white shadow-[8px_8px_0_black] dark:border-[#EAE5C9] dark:bg-[#132E3A] dark:shadow-[8px_8px_0_#EAE5C9]";

const button =
  "border-4 border-black bg-white px-4 py-3 font-bold text-black shadow-[5px_5px_0_black] " +
  "transition-[transform,box-shadow,background-color,color] hover:bg-black hover:text-white focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#D22B2B] " +
  "active:translate-x-[5px] active:translate-y-[5px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 " +
  "dark:border-[#EAE5C9] dark:bg-[#132E3A] dark:text-[#EAE5C9] dark:shadow-[5px_5px_0_#EAE5C9] dark:hover:bg-[#EAE5C9] dark:hover:text-[#06141B]";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function SecurityTerminal({ onboarding = false }: SecurityTerminalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<CrimeLensProfile | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [friendlyName, setFriendlyName] = useState("");

  const loadSecurityState = useCallback(async () => {
    if (!isSupabaseBrowserConfigured) {
      setMessage("Supabase Auth is not configured for this deployment");
      setMessageIsError(true);
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      setAuthenticated(false);
      setProfile(null);
      setPasskeys([]);
      setLoading(false);
      if (!onboarding) router.replace("/");
      return;
    }

    setAuthenticated(true);
    try {
      const authorizedProfile = await loadAuthorizedProfile(
        supabase,
        data.user.id,
      );
      const { data: registeredPasskeys, error: passkeyError } =
        await supabase.auth.passkey.list();
      if (passkeyError) throw passkeyError;

      setProfile(authorizedProfile);
      setPasskeys((registeredPasskeys ?? []) as PasskeyRecord[]);
      setMessage("");
      setMessageIsError(false);
    } catch (error) {
      setProfile(null);
      setPasskeys([]);
      setMessage(
        error instanceof Error && error.message === "AUTHORIZED_PROFILE_INACTIVE"
          ? "Account inactive // enrollment prohibited"
          : "No authorized CrimeLens profile is assigned to this account",
      );
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  }, [onboarding, router]);

  useEffect(() => {
    void loadSecurityState();
    if (!isSupabaseBrowserConfigured) return;

    const supabase = getSupabaseBrowserClient();
    let authEventTimer: number | null = null;
    const { data } = supabase.auth.onAuthStateChange(() => {
      // Defer Supabase calls until after the auth callback releases its lock.
      authEventTimer = window.setTimeout(() => void loadSecurityState(), 0);
    });
    return () => {
      data.subscription.unsubscribe();
      if (authEventTimer !== null) window.clearTimeout(authEventTimer);
    };
  }, [loadSecurityState]);

  const sendEnrollmentLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || working || !isSupabaseBrowserConfigured) return;

    setWorking(true);
    setMessage("");
    setMessageIsError(false);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: buildEnrollmentRedirectUrl(
          process.env.NEXT_PUBLIC_SITE_URL,
          window.location.origin,
        ),
      },
    });

    if (error) {
      setMessage(classifyEnrollmentError(error).message);
      setMessageIsError(true);
    } else {
      setEmailSent(true);
      setMessage("Confirmation link requested // check the authorized inbox");
      setMessageIsError(false);
    }
    setWorking(false);
  };

  const registerPasskey = async () => {
    if (!profile || working) return;
    if (!browserSupportsPasskeys()) {
      setMessage("Passkeys require HTTPS or a supported localhost browser");
      setMessageIsError(true);
      return;
    }

    setWorking(true);
    setMessage("Awaiting device authenticator...");
    setMessageIsError(false);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.registerPasskey();
    if (error) {
      setMessage(classifyPasskeyError(error).message);
      setMessageIsError(true);
    } else {
      await loadSecurityState();
      setMessage("Passkey registered // device ready for passwordless access");
      setMessageIsError(false);
    }
    setWorking(false);
  };

  const renamePasskey = async (passkeyId: string) => {
    const trimmedName = friendlyName.trim();
    if (!trimmedName || trimmedName.length > 120 || working) return;

    setWorking(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.passkey.update({
      passkeyId,
      friendlyName: trimmedName,
    });
    setWorking(false);

    if (error) {
      setMessage("Passkey name could not be updated");
      setMessageIsError(true);
      return;
    }

    setEditingId(null);
    setFriendlyName("");
    setMessage("Passkey designation updated");
    setMessageIsError(false);
    await loadSecurityState();
  };

  const deletePasskey = async (passkey: PasskeyRecord) => {
    if (working) return;
    const confirmed = window.confirm(
      `Remove ${passkey.friendly_name ?? "this passkey"}? You may lose access if it is your only authenticator.`,
    );
    if (!confirmed) return;

    setWorking(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.passkey.delete({
      passkeyId: passkey.id,
    });
    setWorking(false);

    if (error) {
      setMessage("Passkey could not be removed");
      setMessageIsError(true);
      return;
    }

    setMessage("Passkey removed from this account");
    setMessageIsError(false);
    await loadSecurityState();
  };

  const signOut = async () => {
    if (!isSupabaseBrowserConfigured) return;
    setWorking(true);
    await getSupabaseBrowserClient().auth.signOut();
    setAuthenticated(false);
    setProfile(null);
    router.replace("/");
  };

  return (
    <main className="login-terminal min-h-screen bg-[#F4F4F0] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:24px_24px] px-5 py-10 font-mono uppercase tracking-[0.16em] text-black dark:bg-[#06141B] dark:bg-[radial-gradient(#EAE5C9_1px,transparent_1px)] dark:text-[#EAE5C9] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center gap-6">
        <header className={`p-6 sm:p-8 ${panel}`}>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-[9px] font-bold">SECURE LINK // AUTHENTICATOR CONTROL</p>
              <h1 className="mt-3 font-serif text-3xl font-black leading-none tracking-[-0.03em] sm:text-5xl">
                SECURITY // PASSKEYS
              </h1>
              <p className="mt-4 max-w-2xl text-[9px] font-bold leading-5 opacity-70">
                REGISTERED CREDENTIALS REMAIN INSIDE YOUR DEVICE OR PASSWORD
                MANAGER. CRIMELENS STORES NO BIOMETRIC OR DEVICE PIN DATA.
              </p>
            </div>
            <Link href={authenticated ? "/dashboard" : "/"} className={button}>
              [ RETURN ]
            </Link>
          </div>
        </header>

        {loading ? (
          <section className={`p-8 text-center text-xs font-bold ${panel}`} role="status">
            [ RESOLVING AUTHENTICATED SESSION... ]
          </section>
        ) : !authenticated && onboarding ? (
          <section className={`flex flex-col gap-6 p-6 sm:p-8 ${panel}`}>
            <div className="border-l-4 border-black pl-4 dark:border-[#EAE5C9]">
              <h2 className="text-sm font-black">CONTROLLED INITIAL ENROLLMENT</h2>
              <p className="mt-3 text-[9px] font-bold leading-5 opacity-70">
                CONFIRM AN EXISTING, ADMIN-PROVISIONED SUPABASE ACCOUNT. THIS
                TERMINAL WILL NOT CREATE A NEW USER OR ACCEPT AN AGENT ID AS
                PROOF OF IDENTITY.
              </p>
            </div>

            <form onSubmit={sendEnrollmentLink} className="flex flex-col gap-4">
              <label htmlFor="enrollment-email" className="text-[10px] font-bold">
                AUTHORIZED ACCOUNT EMAIL
              </label>
              <input
                id="enrollment-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={working || emailSent}
                required
                autoComplete="email"
                placeholder="INVESTIGATOR@AGENCY.GOV"
                className="border-4 border-black bg-white px-4 py-3 text-sm font-bold text-black outline-none placeholder:text-black/35 focus:bg-black focus:text-white dark:border-[#EAE5C9] dark:bg-[#06141B] dark:text-[#EAE5C9] dark:focus:bg-[#EAE5C9] dark:focus:text-[#06141B]"
              />
              <button type="submit" disabled={working || emailSent} className={button}>
                {working
                  ? "[ REQUESTING TRUSTED CONFIRMATION ]"
                  : emailSent
                    ? "[ CONFIRMATION LINK SENT ]"
                    : "[ CONFIRM EXISTING ACCOUNT ]"}
              </button>
            </form>
          </section>
        ) : profile ? (
          <>
            <section className={`grid gap-4 p-6 sm:grid-cols-3 sm:p-8 ${panel}`}>
              <div>
                <p className="text-[8px] font-bold opacity-60">AGENT</p>
                <p className="mt-2 text-sm font-black">{profile.agent_id}</p>
              </div>
              <div>
                <p className="text-[8px] font-bold opacity-60">CLEARANCE</p>
                <p className="mt-2 text-sm font-black">{profile.clearance}</p>
              </div>
              <div>
                <p className="text-[8px] font-bold opacity-60">ACCOUNT STATUS</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-black">
                  <ShieldCheck className="h-4 w-4" /> ACTIVE
                </p>
              </div>
            </section>

            <section className={`flex flex-col gap-5 p-6 sm:p-8 ${panel}`}>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-black pb-5 dark:border-[#EAE5C9]">
                <div>
                  <h2 className="text-sm font-black">REGISTERED PASSKEYS</h2>
                  <p className="mt-2 text-[8px] font-bold opacity-60">
                    {passkeys.length} DEVICE CREDENTIAL{passkeys.length === 1 ? "" : "S"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void registerPasskey()}
                  disabled={working}
                  className={`${button} flex items-center gap-2`}
                >
                  <Plus className="h-4 w-4" /> [ REGISTER NEW PASSKEY ]
                </button>
              </div>

              {passkeys.length === 0 ? (
                <div className="border-2 border-dashed border-current p-6 text-center">
                  <KeyRound className="mx-auto h-8 w-8" />
                  <p className="mt-4 text-[10px] font-bold">
                    NO DEVICE CREDENTIAL REGISTERED
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-4">
                  {passkeys.map((passkey) => (
                    <li
                      key={passkey.id}
                      className="border-4 border-black p-4 dark:border-[#EAE5C9]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Check className="mt-0.5 h-5 w-5 shrink-0" />
                          <div>
                            <p className="text-[11px] font-black">
                              {passkey.friendly_name ?? "REGISTERED AUTHENTICATOR"}
                            </p>
                            <p className="mt-2 text-[8px] font-bold opacity-60">
                              REGISTERED {formatDate(passkey.created_at)}
                              {passkey.last_used_at
                                ? ` // LAST USED ${formatDate(passkey.last_used_at)}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            aria-label={`Rename ${passkey.friendly_name ?? "passkey"}`}
                            onClick={() => {
                              setEditingId(passkey.id);
                              setFriendlyName(passkey.friendly_name ?? "");
                            }}
                            className="border-2 border-current p-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${passkey.friendly_name ?? "passkey"}`}
                            onClick={() => void deletePasskey(passkey)}
                            className="border-2 border-[#D22B2B] p-2 text-[#D22B2B] focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {editingId === passkey.id ? (
                        <form
                          className="mt-4 flex flex-col gap-3 border-t-2 border-dashed border-current pt-4 sm:flex-row"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void renamePasskey(passkey.id);
                          }}
                        >
                          <input
                            value={friendlyName}
                            onChange={(event) => setFriendlyName(event.target.value)}
                            maxLength={120}
                            aria-label="Passkey friendly name"
                            className="min-w-0 flex-1 border-2 border-current bg-transparent px-3 py-2 text-[10px] font-bold outline-none focus:bg-black focus:text-white dark:focus:bg-[#EAE5C9] dark:focus:text-[#06141B]"
                          />
                          <button type="submit" disabled={working} className={button}>
                            [ SAVE NAME ]
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : authenticated ? (
          <section className={`p-8 text-center ${panel}`}>
            <p className="text-xs font-black">ENROLLMENT NOT AUTHORIZED</p>
            <p className="mt-3 text-[9px] font-bold opacity-70">
              A SERVER-AUTHORIZED, ACTIVE CRIMELENS PROFILE IS REQUIRED.
            </p>
          </section>
        ) : null}

        {message ? (
          <div
            className={`flex items-start gap-3 p-4 text-[9px] font-bold leading-5 ${panel} ${
              messageIsError
                ? "!border-[#D22B2B] !bg-[#FFF4F1] !shadow-[6px_6px_0_#D22B2B] !text-[#8D1B1B] dark:!bg-[#24191A] dark:!text-[#FFAAA0]"
                : ""
            }`}
            role={messageIsError ? "alert" : "status"}
            aria-live="polite"
          >
            {messageIsError ? (
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            ) : null}
            <p className="m-0 min-w-0">{message}</p>
          </div>
        ) : null}

        {authenticated ? (
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={working}
            className={`${button} flex items-center justify-center gap-2 self-start text-[10px]`}
          >
            <LogOut className="h-4 w-4" /> [ TERMINATE SESSION ]
          </button>
        ) : null}
      </div>
    </main>
  );
}
