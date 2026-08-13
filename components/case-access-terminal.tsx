"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { triggerHaptic } from "@/lib/haptics";
import { formatCaseName } from "@/lib/liveblocks";

export function CaseAccessTerminal() {
  const [caseName, setCaseName] = useState("");
  const router = useRouter();

  function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formattedCaseName = formatCaseName(caseName);
    if (!formattedCaseName) return;

    triggerHaptic("heavy");
    router.push(`?case=${formattedCaseName}`);
    setCaseName("");
  }

  return (
    <form
      onSubmit={handleJoinRoom}
      className="flex min-w-0 flex-1 items-center gap-2 font-mono uppercase"
    >
      <label htmlFor="case-access-terminal" className="sr-only">
        Case ID
      </label>
      <input
        id="case-access-terminal"
        type="text"
        placeholder="ENTER CASE ID..."
        value={caseName}
        onChange={(event) => setCaseName(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="h-11 min-w-0 flex-1 border-4 border-black bg-[#F4F4F0] px-2 py-1 !text-xs font-black uppercase text-black shadow-[3px_3px_0_black] outline-none placeholder:text-black/45 focus:outline-none md:w-auto md:min-w-40 md:flex-none md:p-2 md:!text-sm md:shadow-[4px_4px_0_black] lg:min-w-48 dark:border dark:border-[#598392] dark:bg-[#01161E] dark:text-[#EFF6E0] dark:shadow-[inset_0_0_10px_rgba(174,195,176,0.12),0_0_12px_rgba(1,22,30,0.7)] dark:placeholder:text-[#598392]"
      />
      <button
        type="submit"
        disabled={caseName.trim().length === 0}
        className="h-11 shrink-0 whitespace-nowrap border-4 border-black bg-black px-2 py-1 !text-xs font-bold text-white shadow-[3px_3px_0_black] hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-45 max-[374px]:!text-[10px] md:px-4 md:py-2 md:!text-sm md:shadow-[4px_4px_0_black] dark:border dark:border-[#598392] dark:bg-[#124559] dark:text-[#AEC3B0] dark:shadow-[inset_0_0_10px_rgba(174,195,176,0.1),0_0_12px_rgba(1,22,30,0.65)] dark:hover:bg-[#AEC3B0] dark:hover:text-[#01161E]"
      >
        <span className="md:hidden">[ JOIN ]</span>
        <span className="hidden md:inline">[ INITIATE UPLINK ]</span>
      </button>
    </form>
  );
}
