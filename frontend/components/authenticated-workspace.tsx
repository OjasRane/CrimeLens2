"use client";
import { navigateAccountBoundary } from "@/lib/account-navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { loadAuthorizedProfile } from "@/lib/crimelens-auth";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getInvestigationBundle } from "@/lib/crimelens-api";
import { clearPrivateInvestigations } from "@/data/investigations/registry";
import { safeReturnPath } from "@/lib/public-access";
import { useInvestigationStore } from "@/store/use-investigation-store";

const AccountContext = createContext("");
export const useAccountId = () => useContext(AccountContext);
export function clearAccountState() {
  useInvestigationStore.setState(useInvestigationStore.getInitialState(), true);
  clearPrivateInvestigations();
}
export function AuthenticatedWorkspace({children}: {children:ReactNode}) {
  const [userId,setUserId] = useState("");
  const [message,setMessage] = useState("Verifying your session…");
  const [attempt,setAttempt] = useState(0);
  useEffect(()=>{
    let active=true;
    let verifiedId="";
    let unsubscribe=()=>{};
    const verify = async()=>{
      try {
        const supabase=getSupabaseBrowserClient();
        const {data,error}=await supabase.auth.getUser();
        if (!active) return;
        if (error || !data.user) {
          const next=safeReturnPath(window.location.pathname+window.location.search);
          window.location.replace(`/?next=${encodeURIComponent(next)}#signup`); return;
        }
        verifiedId=data.user.id;
        await loadAuthorizedProfile(supabase,data.user.id,true);
        if (!active) return;
        clearAccountState();
        if (["/workspace","/dashboard","/uplink"].includes(window.location.pathname)) {
          const params=new URLSearchParams(window.location.search);
          const caseId=params.get("investigation");
          if (!caseId) { window.location.replace("/cases"); return; }
          const investigation=await getInvestigationBundle(caseId);
          if (!active) return;
          useInvestigationStore.getState().hydrateInvestigation(investigation);
          useInvestigationStore.getState().setActiveInvestigationId(caseId);
          const view=params.get("view");
          if (["map","network","timeline","evidence","canvas"].includes(view ?? "")) useInvestigationStore.getState().setActiveWorkspace(view as "map");
        }
        if (active) setUserId(data.user.id);
      } catch(cause) { if(active) {setUserId("");setMessage(cause instanceof Error ? cause.message : "Access could not be verified. Retry.");} }
    };
    try {
      const {data}=getSupabaseBrowserClient().auth.onAuthStateChange((event,session)=>{
        if (event === "SIGNED_OUT" || (verifiedId && session?.user.id && session.user.id !== verifiedId)) {
          active=false;setUserId("");clearAccountState();window.location.replace("/");
        }
      }); unsubscribe=()=>data.subscription.unsubscribe();
    } catch { /* Configuration errors are displayed by verify. */ }
    void verify();
    return ()=>{active=false;unsubscribe();};
  },[attempt]);
  if(!userId) return <main className="cases-page"><h1>Case access</h1><p role="status">{message}</p><button className="archive-button mt-6" onClick={()=>setAttempt(n=>n+1)}>Retry access</button><Link className="block mt-6" href="/">Return to the public archive</Link></main>;
  return <AccountContext.Provider value={userId}><div key={userId}>{children}</div><nav aria-label="Account" className="fixed right-2 top-2 z-[150] flex bg-[var(--paper)] border-2 border-[var(--ink)] text-[var(--ink)]"><Link href="/security" aria-label="Manage passkeys" className="grid h-11 w-11 place-items-center border-r-2 border-[var(--ink)]"><KeyRound size={18}/></Link><button aria-label="Sign out" className="grid h-11 w-11 place-items-center" onClick={async()=>{const {error}=await getSupabaseBrowserClient().auth.signOut();if(error) {setMessage("Sign out failed. Retry.");return;}setUserId("");clearAccountState();navigateAccountBoundary("/");}}><LogOut size={18}/></button></nav>{message.startsWith("Sign out failed") && <p role="alert" className="fixed bottom-0 bg-[var(--paper)] z-[160] p-3">{message}</p>}</AccountContext.Provider>;
}
