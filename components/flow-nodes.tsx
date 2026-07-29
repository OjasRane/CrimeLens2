"use client";

import type { ChangeEvent } from "react";
import type { NodeProps } from "@xyflow/react";
import { useInvestigationStore } from "@/store/use-investigation-store";

export function StickyNoteNode({ id, data }: NodeProps) {
  const updateNodeData = useInvestigationStore((state) => state.updateNodeData);
  const text = typeof data.text === "string" ? data.text : "";

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    updateNodeData(id, { text: event.target.value });
  }

  return (
    <div className="relative h-48 w-48 border-2 border-black bg-[#FCD34D] p-4 pt-6 shadow-[4px_4px_0_black] rounded-none">
      <div className="absolute left-1/2 top-[-10px] h-5 w-16 -translate-x-1/2 border-2 border-black bg-white shadow-[2px_2px_0_black] rounded-none" />
      <textarea
        value={text}
        onChange={handleChange}
        className="nodrag nopan h-full w-full resize-none border-0 bg-transparent font-mono text-sm leading-tight text-black outline-none placeholder:text-black/50 rounded-none"
        placeholder="TYPE FACT..."
        aria-label="Sticky note text"
      />
    </div>
  );
}

export function PolaroidNode({ data }: NodeProps) {
  const caption = typeof data.caption === "string" ? data.caption : "UNTITLED";

  return (
    <div className="w-56 border-2 border-black bg-white p-3 pb-4 shadow-[4px_4px_0_black] rounded-none">
      <div className="flex aspect-square items-center justify-center border-2 border-black bg-[#F4F4F0] font-mono text-xs uppercase text-black rounded-none">
        Image Placeholder
      </div>
      <div className="mt-3 border-t-2 border-black pt-2 text-center font-mono text-xs font-bold uppercase tracking-normal text-black">
        {caption}
      </div>
    </div>
  );
}
