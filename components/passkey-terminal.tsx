"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  CircleDashed,
  KeyRound,
  Moon,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  authProgress,
  browserSupportsPasskeys,
  classifyPasskeyError,
  loadAuthorizedProfile,
  type AuthVisualState,
  type CrimeLensProfile,
} from "@/lib/crimelens-auth";
import {
  getSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase-browser";

const panel =
  "border-4 border-black bg-white shadow-[8px_8px_0_black] " +
  "dark:border-[#EAE5C9] dark:bg-[#132E3A] dark:shadow-[8px_8px_0_#EAE5C9]";

const physicalButton =
  "border-4 border-black bg-white text-black shadow-[6px_6px_0_black] " +
  "transition-[transform,box-shadow,background-color,color] duration-150 hover:bg-black hover:text-white " +
  "focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#D22B2B] " +
  "active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-55 " +
  "dark:border-[#EAE5C9] dark:bg-[#132E3A] dark:text-[#EAE5C9] " +
  "dark:shadow-[6px_6px_0_#EAE5C9] dark:hover:bg-[#EAE5C9] dark:hover:text-[#06141B]";

const orderedStates: AuthVisualState[] = [
  "idle",
  "checking_support",
  "requesting",
  "awaiting_authenticator",
  "verifying",
  "loading_profile",
  "success",
  "denied",
  "cancelled",
  "unsupported",
  "error",
];

const stateCopy: Record<
  AuthVisualState,
  { eyebrow: string; title: string; detail: string; status: string }
> = {
  idle: {
    eyebrow: "AUTH // STANDBY",
    title: "DEVICE AUTHENTICATOR READY",
    detail: "AWAITING IDENTITY CHALLENGE",
    status: "SECURE CHANNEL // READY",
  },
  checking_support: {
    eyebrow: "AUTH // CAPABILITY CHECK",
    title: "CHECKING AUTHENTICATOR...",
    detail: "WEBAUTHN CAPABILITY // DEVICE / BROWSER",
    status: "VALIDATING SECURE CONTEXT",
  },
  requesting: {
    eyebrow: "AUTH // CHALLENGE 01",
    title: "ISSUING CRYPTOGRAPHIC CHALLENGE",
    detail: "SUPABASE AUTH // REQUEST IN FLIGHT",
    status: "REQUESTING CHALLENGE",
  },
  awaiting_authenticator: {
    eyebrow: "AUTH // DEVICE HANDOFF",
    title: "AWAITING DEVICE VERIFICATION",
    detail: "USE YOUR REGISTERED AUTHENTICATOR TO CONTINUE",
    status: "AUTHENTICATOR PROMPT ACTIVE",
  },
  verifying: {
    eyebrow: "AUTH // ASSERTION",
    title: "CRYPTOGRAPHIC ASSERTION ACCEPTED",
    detail: "SESSION ESTABLISHED // RESOLVING AUTHORIZATION",
    status: "AUTHENTICATION VERIFIED",
  },
  loading_profile: {
    eyebrow: "AUTH // AUTHORIZATION",
    title: "IDENTITY CONFIRMED",
    detail: "LOADING SERVER-AUTHORIZED CLEARANCE",
    status: "PROFILE RESOLUTION IN PROGRESS",
  },
  success: {
    eyebrow: "AUTH // VERIFIED",
    title: "ACCESS GRANTED",
    detail: "IDENTITY CONFIRMED // SESSION ESTABLISHED",
    status: "CLEARANCE RESOLVED",
  },
  denied: {
    eyebrow: "AUTH // NOT VERIFIED",
    title: "IDENTITY NOT VERIFIED",
    detail: "NO AUTHORIZED ACCESS GRANTED",
    status: "ACCESS DENIED",
  },
  cancelled: {
    eyebrow: "AUTH // CANCELLED",
    title: "AUTHENTICATION CANCELLED",
    detail: "NO SESSION CREATED",
    status: "CHANNEL RESET AVAILABLE",
  },
  unsupported: {
    eyebrow: "AUTH // UNAVAILABLE",
    title: "NO COMPATIBLE AUTHENTICATOR",
    detail: "USE A SUPPORTED DEVICE OR SECURITY KEY",
    status: "WEBAUTHN UNAVAILABLE",
  },
  error: {
    eyebrow: "AUTH // SERVICE ERROR",
    title: "AUTH SERVICE UNAVAILABLE",
    detail: "RETRY SECURE CONNECTION",
    status: "SESSION NOT CREATED",
  },
};

const activeStates = new Set<AuthVisualState>([
  "checking_support",
  "requesting",
  "awaiting_authenticator",
  "verifying",
  "loading_profile",
]);

function stateReached(
  state: AuthVisualState,
  checkpoint: "challenge" | "credential" | "session" | "profile",
) {
  const progress = authProgress[state];
  const target = { challenge: 25, credential: 75, session: 75, profile: 100 }[
    checkpoint
  ];
  return progress >= target;
}

function playVerifiedTone() {
  try {
    const audio = new AudioContext();
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.45);
    gain.connect(audio.destination);

    [523.25, 659.25].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(audio.currentTime + index * 0.08);
      oscillator.stop(audio.currentTime + 0.32 + index * 0.08);
    });

    window.setTimeout(() => void audio.close(), 650);
  } catch {
    // Audio is optional; authentication never depends on it.
  }
}

export function PasskeyTerminal() {
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [authState, setAuthState] = useState<AuthVisualState>("idle");
  const [profile, setProfile] = useState<CrimeLensProfile | null>(null);
  const [authError, setAuthError] = useState("");
  const ceremonyActive = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const redirectTimer = useRef<number | null>(null);
  const componentActive = useRef(true);

  useEffect(() => {
    setMounted(true);
    componentActive.current = true;

    return () => {
      componentActive.current = false;
      abortController.current?.abort();
      if (redirectTimer.current !== null) {
        window.clearTimeout(redirectTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseBrowserConfigured) return;

    const restoreExistingSession = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user || !componentActive.current) return;

      try {
        const existingProfile = await loadAuthorizedProfile(
          supabase,
          data.user.id,
        );
        if (!componentActive.current) return;
        setProfile(existingProfile);
        router.replace("/dashboard");
      } catch {
        await supabase.auth.signOut();
      }
    };

    void restoreExistingSession();
  }, [router]);

  const isDark = mounted ? resolvedTheme === "dark" : true;
  const copy = stateCopy[authState];
  const progress = authProgress[authState];
  const isBusy = activeStates.has(authState);

  const startPasskeyAuthentication = async () => {
    if (ceremonyActive.current) return;
    ceremonyActive.current = true;
    setProfile(null);
    setAuthError("");
    setAuthState("checking_support");

    if (!isSupabaseBrowserConfigured) {
      setAuthState("error");
      setAuthError(
        "Supabase Auth is not configured // review the deployment environment",
      );
      ceremonyActive.current = false;
      return;
    }

    if (!browserSupportsPasskeys()) {
      setAuthState("unsupported");
      setAuthError(
        window.isSecureContext
          ? "This browser does not expose WebAuthn"
          : "Passkeys require HTTPS or a supported localhost context",
      );
      ceremonyActive.current = false;
      return;
    }

    const controller = new AbortController();
    abortController.current = controller;
    const supabase = getSupabaseBrowserClient();

    try {
      setAuthState("requesting");
      const signInRequest = supabase.auth.signInWithPasskey({
        options: { signal: controller.signal },
      });
      setAuthState("awaiting_authenticator");

      const { data, error } = await signInRequest;
      if (error) throw error;
      if (!data.session || !data.user) {
        throw new Error("Supabase did not establish an authenticated session");
      }

      setAuthState("verifying");
      const { data: verifiedUser, error: userError } =
        await supabase.auth.getUser();
      if (userError || !verifiedUser.user) {
        throw userError ?? new Error("Authenticated user could not be verified");
      }

      setAuthState("loading_profile");
      let authorizedProfile: CrimeLensProfile;
      try {
        authorizedProfile = await loadAuthorizedProfile(
          supabase,
          verifiedUser.user.id,
        );
      } catch (profileError) {
        await supabase.auth.signOut();
        if (!componentActive.current) return;
        const marker =
          profileError instanceof Error ? profileError.message : "";
        if (
          marker === "AUTHORIZED_PROFILE_INACTIVE" ||
          marker === "AUTHORIZED_PROFILE_NOT_FOUND"
        ) {
          setAuthState("denied");
          setAuthError(
            marker === "AUTHORIZED_PROFILE_INACTIVE"
              ? "Account inactive // contact the clearance administrator"
              : "No authorized CrimeLens profile is assigned to this account",
          );
        } else {
          setAuthState("error");
          setAuthError(
            "Authorization profile service unavailable // retry connection",
          );
        }
        return;
      }

      if (!componentActive.current) return;
      setProfile(authorizedProfile);
      setAuthState("success");
      if (!reduceMotion) playVerifiedTone();

      redirectTimer.current = window.setTimeout(
        () => router.replace("/dashboard"),
        reduceMotion ? 250 : 850,
      );
    } catch (error) {
      if (!componentActive.current) return;
      const classified = classifyPasskeyError(error);
      setAuthState(classified.state);
      setAuthError(classified.message);
    } finally {
      abortController.current = null;
      ceremonyActive.current = false;
    }
  };

  const icon = (() => {
    if (authState === "success") {
      return <ShieldCheck className="h-9 w-9 sm:h-14 sm:w-14" />;
    }
    if (authState === "denied" || authState === "error") {
      return <ShieldAlert className="h-9 w-9 sm:h-14 sm:w-14" />;
    }
    if (authState === "cancelled") {
      return <X className="h-9 w-9 sm:h-14 sm:w-14" />;
    }
    if (isBusy) {
      return <CircleDashed className="h-9 w-9 sm:h-14 sm:w-14" />;
    }
    return <KeyRound className="h-9 w-9 sm:h-14 sm:w-14" />;
  })();

  return (
    <main className="login-terminal min-h-screen w-full bg-[#F4F4F0] bg-[radial-gradient(#000000_1px,transparent_1px)] [background-size:24px_24px] font-mono uppercase tracking-[0.18em] text-black dark:bg-[#06141B] dark:bg-[radial-gradient(#EAE5C9_1px,transparent_1px)] dark:[background-size:24px_24px] dark:text-[#EAE5C9]">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center gap-5 px-3 py-5 sm:gap-8 sm:px-8 sm:py-10">
        <div className="flex items-center justify-between gap-4 text-[10px] font-bold">
          <span className="bg-[#F4F4F0] px-2 py-1 tracking-[0.24em] dark:bg-[#06141B] sm:tracking-[0.32em]">
            SECURE // {isDark ? "EVIDENCE-LOCKER" : "EVIDENCE-BOARD"} MODE
          </span>
          <button
            type="button"
            aria-label="Toggle color theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`flex shrink-0 items-center gap-2 px-3 py-2 text-[10px] tracking-[0.2em] ${physicalButton}`}
          >
            {isDark ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
            {isDark ? "LIGHT" : "DARK"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <section className={`flex flex-col gap-5 p-4 sm:gap-6 sm:p-8 ${panel}`}>
            <header className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[9px] font-bold">
                <span className="inline-block h-2 w-2 bg-black dark:bg-[#EAE5C9]" />
                SECURE LINK // ROOT ACCESS // LOGIN
              </div>
              <h1 className="font-serif text-2xl font-black leading-[0.95] tracking-[-0.035em] sm:text-4xl">
                GLOBAL INTEL INDEX
                <br />
                <span className="text-xl sm:text-3xl">
                  // CLEARANCE TERMINAL V5.0
                </span>
              </h1>
            </header>

            <button
              type="button"
              onClick={() => void startPasskeyAuthentication()}
              disabled={isBusy}
              aria-label="Verify identity with a passkey"
              className={`group flex w-full items-center justify-center gap-3 px-5 py-4 text-sm font-bold tracking-[0.15em] sm:tracking-[0.2em] ${physicalButton}`}
            >
              <KeyRound className="h-5 w-5" aria-hidden="true" />
              {isBusy
                ? "[ AUTHENTICATION IN PROGRESS ]"
                : "[ VERIFY WITH PASSKEY ]"}
            </button>

            <p className="border-2 border-dashed border-black bg-white px-4 py-3 text-[9px] font-bold leading-5 dark:border-[#EAE5C9] dark:bg-[#132E3A]">
              PUBLIC-KEY AUTHENTICATION
              <br />
              YOUR AUTHENTICATOR WILL REQUEST LOCAL IDENTITY VERIFICATION.
            </p>

            <div className="flex flex-col gap-2 text-[10px] font-bold">
              <span>AGENT IDENTIFICATION</span>
              <div className="min-h-12 border-4 border-black bg-white px-3 py-3 text-sm font-bold tracking-[0.16em] dark:border-[#EAE5C9] dark:bg-[#06141B]">
                {profile ? `AGENT // ${profile.agent_id}` : "RESOLVED AFTER AUTHENTICATION"}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-4 border-black px-4 py-3 text-[11px] font-bold dark:border-[#EAE5C9]">
              <span className="flex items-center gap-2">
                {profile ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                CLEARANCE // {profile ? profile.clearance : "UNRESOLVED"}
              </span>
              <span className="hidden tracking-[0.3em] sm:inline">
                {profile ? "◈◈◈◈◈" : "◇◇◇◇◇"}
              </span>
            </div>

            <div
              className="min-h-12 border-l-4 border-black pl-4 text-[9px] font-bold leading-5 dark:border-[#EAE5C9]"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {authError || copy.status}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] font-bold">
              <Link
                href="/enroll"
                className="border-b-2 border-current pb-1 focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                CONTROLLED DEVICE ENROLLMENT
              </Link>
              <span aria-hidden="true">//</span>
              <span className="opacity-60">WEBAUTHN / SUPABASE AUTH</span>
            </div>

            {process.env.NODE_ENV === "development" ? (
              <div className="flex flex-col gap-2 border-t-4 border-dashed border-black pt-4 dark:border-[#EAE5C9]">
                <span className="text-[9px] font-bold opacity-60">
                  // DEV VISUAL PREVIEW ONLY
                </span>
                <div className="flex flex-wrap gap-2">
                  {orderedStates.map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => {
                        if (!ceremonyActive.current) {
                          setAuthError("");
                          setAuthState(state);
                        }
                      }}
                      className="border-2 border-current px-2 py-1 text-[8px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {state.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-6">
            <div className={`relative aspect-square w-full overflow-hidden p-1 max-[370px]:aspect-[4/5] ${panel}`}>
              <div className="relative flex h-full w-full flex-col overflow-hidden bg-white p-5 dark:bg-[#06141B] sm:p-10">
                {["left-3 top-3", "right-3 top-3", "left-3 bottom-3", "right-3 bottom-3"].map(
                  (position, index) => (
                    <span
                      key={position}
                      className={`absolute h-7 w-7 border-black dark:border-[#EAE5C9] ${position} ${
                        index < 2 ? "border-t-4" : "border-b-4"
                      } ${index % 2 === 0 ? "border-l-4" : "border-r-4"}`}
                    />
                  ),
                )}

                <div className="flex items-center justify-between border-b-2 border-dashed border-current pb-3 text-[8px] font-bold opacity-70 sm:text-[9px]">
                  <span>CHANNEL // PK-01</span>
                  <span className="flex items-center gap-2">
                    <Radio className="h-3.5 w-3.5" /> LIVE
                  </span>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={authState}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: reduceMotion ? 0 : 0.18 }}
                      className="flex max-w-sm flex-col items-center"
                    >
                      <div
                        className={`mb-3 border-4 border-current p-3 sm:mb-6 sm:p-4 ${
                          isBusy && !reduceMotion ? "animate-pulse" : ""
                        }`}
                        aria-hidden="true"
                      >
                        {icon}
                      </div>
                      <p className="text-[9px] font-bold opacity-60">
                        {copy.eyebrow}
                      </p>
                      <h2 className="mt-3 text-base font-black leading-tight tracking-[0.14em] sm:text-xl">
                        {copy.title}
                      </h2>
                      <p className="mt-2 text-[8px] font-bold leading-4 opacity-70 sm:mt-4 sm:text-[10px] sm:leading-5">
                        {copy.detail}
                      </p>
                      {authState === "success" && profile ? (
                        <div className="mt-5 border-2 border-current px-4 py-3 text-[9px] font-bold leading-5">
                          AGENT // {profile.agent_id}
                          <br />
                          CLEARANCE // {profile.clearance}
                        </div>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-t-2 border-dashed border-current pt-2 text-[7px] font-bold tracking-[0.05em] sm:gap-x-4 sm:gap-y-2 sm:pt-4 sm:text-[9px] sm:tracking-[0.18em]">
                  {(
                    [
                      ["CHALLENGE", "challenge"],
                      ["CREDENTIAL", "credential"],
                      ["SESSION", "session"],
                      ["PROFILE", "profile"],
                    ] as const
                  ).map(([label, checkpoint]) => {
                    const reached = stateReached(authState, checkpoint);
                    return (
                      <span key={label} className="flex items-center justify-between gap-2">
                        {label}
                        <span className="flex items-center gap-1">
                          {reached ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span aria-hidden="true">—</span>
                          )}
                          {reached ? "VERIFIED" : "PENDING"}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={`flex flex-col gap-3 p-5 ${panel}`}>
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span>IDENTITY CHALLENGE</span>
                <span>{progress}%</span>
              </div>
              <div
                className="grid h-6 grid-cols-10 gap-1 border-4 border-black bg-white p-1 dark:border-[#EAE5C9] dark:bg-[#06141B]"
                role="progressbar"
                aria-label="Authentication sequence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                {Array.from({ length: 10 }, (_, index) => (
                  <span
                    key={index}
                    className={
                      index < Math.ceil(progress / 10)
                        ? "bg-black dark:bg-[#EAE5C9]"
                        : "bg-black/10 dark:bg-[#EAE5C9]/10"
                    }
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
