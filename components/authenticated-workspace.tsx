"use client";

import type { ReactNode } from "react";
import { KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadAuthorizedProfile } from "@/lib/crimelens-auth";
import {
  getSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase-browser";

export function AuthenticatedWorkspace({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("VERIFYING SUPABASE SESSION...");

  useEffect(() => {
    if (!isSupabaseBrowserConfigured) {
      setMessage("SUPABASE AUTH IS NOT CONFIGURED");
      return;
    }

    let active = true;
    const supabase = getSupabaseBrowserClient();

    const verifyAccess = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        router.replace("/");
        return;
      }

      try {
        await loadAuthorizedProfile(supabase, data.user.id);
        if (active) setAuthorized(true);
      } catch {
        await supabase.auth.signOut();
        if (!active) return;
        setMessage("AUTHORIZED CRIMELENS PROFILE REQUIRED");
        router.replace("/");
      }
    };

    void verifyAccess();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAuthorized(false);
        router.replace("/");
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [router]);

  if (!authorized) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F4F4F0] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:24px_24px] p-6 font-mono text-black dark:bg-[#06141B] dark:bg-[radial-gradient(#EAE5C9_1px,transparent_1px)] dark:text-[#EAE5C9]">
        <p className="border-4 border-current bg-white p-6 text-center text-xs font-black uppercase tracking-[0.18em] shadow-[7px_7px_0_currentColor] dark:bg-[#132E3A]">
          [ {message} ]
        </p>
      </main>
    );
  }

  return (
    <>
      {children}
      <nav
        aria-label="Account security"
        className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[65] flex border-2 border-black bg-white font-mono text-black shadow-[3px_3px_0_black] dark:border-[#EAE5C9] dark:bg-[#06141B] dark:text-[#EAE5C9] dark:shadow-[3px_3px_0_#EAE5C9]"
      >
        <Link
          href="/security"
          aria-label="Manage passkeys"
          className="border-r-2 border-current p-2 hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-[#EAE5C9] dark:hover:text-[#06141B]"
        >
          <KeyRound className="h-4 w-4" />
        </Link>
        <button
          type="button"
          aria-label="Terminate authenticated session"
          onClick={() => void getSupabaseBrowserClient().auth.signOut()}
          className="p-2 hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-[#EAE5C9] dark:hover:text-[#06141B]"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </nav>
    </>
  );
}
