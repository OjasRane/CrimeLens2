"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Fingerprint,
  LockKeyhole,
} from "lucide-react";
import { navigateAccountBoundary } from "@/lib/account-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { publicCases, safeReturnPath } from "@/lib/public-access";
import {
  buildAuthCallbackUrl,
  browserSupportsPasskeys,
  classifyEnrollmentError,
  classifyOAuthError,
  classifyPasskeyError,
  loadAuthorizedProfile,
} from "@/lib/crimelens-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const caseLabels = [
  "Fictional demo",
  "Mumbai 26/11",
  "Your next investigation",
] as const;

const caseActions = ["Explore demo", "Explore 26/11", "Create your own case"] as const;

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.71-.06-1.24-.2-1.79H12v3.4h5.52a4.72 4.72 0 0 1-2.05 3.09l-.02.11 2.98 2.31.21.02c1.93-1.78 2.96-4.4 2.96-7.14Z"
      />
      <path
        fill="currentColor"
        d="M12 22c2.76 0 5.07-.91 6.76-2.47l-3.22-2.5c-.86.58-2.01.99-3.54.99a6.15 6.15 0 0 1-5.82-4.25l-.11.01-3.1 2.4-.04.1A10.22 10.22 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        d="M6.18 13.77A6.28 6.28 0 0 1 5.84 12c0-.62.12-1.22.33-1.77v-.12L3.04 7.67l-.1.05A10.11 10.11 0 0 0 1.86 12c0 1.54.37 3 1.07 4.28l3.25-2.51Z"
      />
      <path
        fill="currentColor"
        d="M12 5.98c1.92 0 3.22.83 3.97 1.52l2.85-2.78A9.73 9.73 0 0 0 12 2a10.22 10.22 0 0 0-9.07 5.72l3.24 2.51A6.18 6.18 0 0 1 12 5.98Z"
      />
    </svg>
  );
}

export function PublicEntry() {
  const [selected, setSelected] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const touchX = useRef(0);
  const inFlight = useRef(false);
  const signupRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const select = (index: number) =>
    setSelected((index + caseLabels.length) % caseLabels.length);
  const destination = () =>
    safeReturnPath(
      new URLSearchParams(window.location.search).get("next"),
      "/cases/new",
    );

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const isAuthReturn =
      search.has("code") ||
      search.has("error") ||
      fragment.has("access_token") ||
      fragment.has("error");

    if (!isAuthReturn) return;

    let active = true;
    const finishFallbackCallback = async () => {
      if (search.has("error") || fragment.has("error")) {
        if (!active) return;
        setError(true);
        setMessage("Sign-in was cancelled or the authentication link expired. Please try again.");
        return;
      }

      setBusy(true);
      setMessage("Completing secure sign-in…");
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data.user) {
          throw userError ?? new Error("No authenticated user was returned");
        }
        await loadAuthorizedProfile(supabase, data.user.id, true);
        if (active) {
          navigateAccountBoundary(
            safeReturnPath(search.get("next"), "/cases/new"),
          );
        }
      } catch {
        if (!active) return;
        setError(true);
        setMessage(
          "Your identity was verified, but CrimeLens could not finish account access. Retry sign-in or contact the administrator.",
        );
        setBusy(false);
      }
    };

    void finishFallbackCallback();
    return () => {
      active = false;
    };
  }, []);

  function focusSignup() {
    setSelected(2);
    signupRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 350);
  }

  function handleCarouselKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      select(selected + (event.key === "ArrowRight" ? 1 : -1));
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      select(event.key === "Home" ? 0 : caseLabels.length - 1);
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchX.current = event.touches[0].clientX;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const delta = event.changedTouches[0].clientX - touchX.current;
    if (Math.abs(delta) > 50) select(selected + (delta < 0 ? 1 : -1));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    setMessage("");
    setSent(false);
    try {
      const callback = new URL(
        buildAuthCallbackUrl(window.location.origin),
      );
      callback.searchParams.set("next", destination());
      const { error: signupError } =
        await getSupabaseBrowserClient().auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: true,
            data: { display_name: name.trim() },
            emailRedirectTo: callback.toString(),
          },
        });
      if (signupError) throw signupError;
      setSent(true);
      setMessage(
        "Check your inbox for a verification link. If you already have an account, this link signs you in. You can request a fresh link below.",
      );
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error && cause.message.includes("not configured")
          ? cause.message
          : classifyEnrollmentError(cause).message,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function google() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    setMessage("Opening Google sign-in…");
    try {
      const callback = new URL(
        buildAuthCallbackUrl(window.location.origin),
      );
      callback.searchParams.set("next", destination());
      const { error: oauthError } =
        await getSupabaseBrowserClient().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: callback.toString() },
        });
      if (oauthError) throw oauthError;
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error && cause.message.includes("not configured")
          ? cause.message
          : classifyOAuthError(cause).message,
      );
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function passkey() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    setMessage("Waiting for your authenticator…");
    try {
      if (!browserSupportsPasskeys()) throw { name: "NotSupportedError" };
      const supabase = getSupabaseBrowserClient();
      const { data, error: passkeyError } =
        await supabase.auth.signInWithPasskey();
      if (passkeyError) throw passkeyError;
      if (!data.user) throw new Error("No verified user");
      await loadAuthorizedProfile(supabase, data.user.id, true);
      navigateAccountBoundary(destination());
    } catch (cause) {
      setError(true);
      setMessage(
        `${classifyPasskeyError(cause).message}. Retry, or continue with email.`,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="public-entry">
      <header className="archive-header">
        <Link href="/" className="archive-brand">
          <span className="archive-brand-mark">FL</span>
          <span>
            The Fatal Ledger
            <small>CRIMELENS / INVESTIGATION SYSTEM</small>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="entry-grid">
        <section className="archive-section" aria-label="Public case archive">
          <p className="archive-eyebrow">THE ARCHIVE / OPEN TO THE CURIOUS</p>
          <h1>
            Every detail matters.
            <br />
            <em>Follow the evidence.</em>
          </h1>
          <p className="archive-intro">
            Step inside a case. Trace its timeline, examine the evidence, and
            see how the pieces connect.
          </p>

          <div
            className="archive-stage"
            role="region"
            aria-roledescription="carousel"
            aria-label="Case folders"
            tabIndex={0}
            onKeyDown={handleCarouselKeyDown}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {[...publicCases, undefined].map((investigation, index) => {
              const position =
                (index - selected + caseLabels.length) % caseLabels.length;
              const active = index === selected;
              const title = investigation?.name ?? "Your next investigation";
              const classification =
                index === 0
                  ? "FICTIONAL DEMONSTRATION"
                  : index === 1
                    ? "HISTORICAL RECONSTRUCTION"
                    : "PRIVATE / YOUR EYES ONLY";

              return (
                <article
                  key={investigation?.id ?? "new"}
                  className={`archive-folder folder-position-${position}`}
                  aria-current={active ? "true" : undefined}
                >
                  <div className="folder-tab" aria-hidden="true">
                    {index === 2 ? "UNFILED" : `CASE FILE / 0${index + 1}`}
                  </div>
                  <div className="folder-surface">
                    <div className="folder-header">
                      <span>{index === 2 ? "NEW-000" : `ARCH-00${index + 1}`}</span>
                      <span>{index === 2 ? "PRIVATE" : "PUBLIC"}</span>
                    </div>
                    <div className="folder-body">
                      <span className="folder-classification">{classification}</span>
                      <h2 className="folder-title">{title}</h2>
                      <span className="folder-rule" />
                      <p className="folder-detail">
                        {investigation?.location ??
                          "The next chapter starts with you."}
                      </p>
                      <p className="folder-summary">
                        {investigation?.summary ??
                          "A private space for your evidence, connections, and working theories."}
                      </p>
                      {active ? (
                        investigation ? (
                          <Link
                            className="archive-button folder-action"
                            href={`/demo/${investigation.id}`}
                          >
                            {caseActions[index]}
                            <ArrowUpRight size={18} />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="archive-button folder-action"
                            onClick={focusSignup}
                          >
                            {caseActions[index]}
                            <ArrowUpRight size={18} />
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                  {!active ? (
                    <button
                      type="button"
                      className="folder-select-overlay"
                      onClick={() => select(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      aria-label={`Select ${caseLabels[index]}`}
                    />
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="archive-controls">
            <button
              type="button"
              className="carousel-arrow"
              aria-label="Previous case"
              onClick={() => select(selected - 1)}
              onMouseDown={(event) => event.preventDefault()}
            >
              <ArrowLeft size={22} />
            </button>
            <span className="carousel-count" aria-live="polite">
              0{selected + 1} / 0{caseLabels.length}
            </span>
            <button
              type="button"
              className="carousel-arrow"
              aria-label="Next case"
              onClick={() => select(selected + 1)}
              onMouseDown={(event) => event.preventDefault()}
            >
              <ArrowRight size={22} />
            </button>
          </div>

          <div className="case-selectors" role="tablist" aria-label="Select a case">
            {caseLabels.map((label, index) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={selected === index}
                onClick={() => select(index)}
                onMouseDown={(event) => event.preventDefault()}
              >
                {label}
              </button>
            ))}
          </div>

          <nav className="direct-demos" aria-label="Open a public demo">
            <span>NO ACCOUNT REQUIRED</span>
            <Link href="/demo/demo">Explore demo ↗</Link>
            <Link href="/demo/mumbai-2611">Explore 26/11 ↗</Link>
          </nav>
        </section>

        <section
          ref={signupRef}
          id="signup"
          className={`signup-sheet ${selected === 2 ? "signup-highlight" : ""}`}
          aria-labelledby="signup-heading"
        >
          <span className="signup-tab">NEW INVESTIGATION</span>
          <div className="sheet-top">
            <span>PERSONNEL FILE / 001</span>
            <LockKeyhole size={17} />
          </div>
          <h2 id="signup-heading">
            Open your
            <br />
            own case.
          </h2>
          <p>Build your evidence board, connect the dots, and bring your team in.</p>
          <form onSubmit={submit}>
            <label htmlFor="display-name">01 / DISPLAY NAME</label>
            <input
              ref={nameRef}
              id="display-name"
              autoComplete="name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
            <label htmlFor="signup-email">02 / EMAIL ADDRESS</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-describedby="signup-status"
            />
            <button className="archive-button archive-primary" disabled={busy}>
              {busy
                ? "Connecting…"
                : sent
                  ? "Send a fresh link"
                  : "Continue with email"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div
            id="signup-status"
            role={error ? "alert" : "status"}
            className={`signup-status ${error ? "signup-error" : ""}`}
          >
            {message ||
              "Verify your email. Then secure your account with a passkey."}
          </div>
          <div className="sheet-divider">OR SIGN IN DIRECTLY</div>
          <div className="signup-auth-options">
            <button
              type="button"
              disabled={busy}
              className="archive-button passkey-button"
              onClick={() => void google()}
            >
              <GoogleMark />
              Sign in with Google
            </button>
            <button
              type="button"
              disabled={busy}
              className="archive-button passkey-button"
              onClick={() => void passkey()}
            >
              <Fingerprint size={21} />
              Sign in with a passkey
            </button>
          </div>
          <p className="sheet-footnote">
            <LockKeyhole size={13} /> Your cases are private by default.
          </p>
        </section>
      </div>

      <footer className="archive-footer">
        <span>OBSERVE. CONNECT. UNDERSTAND.</span>
        <span>THE FATAL LEDGER / CRIMELENS2</span>
      </footer>
    </main>
  );
}
