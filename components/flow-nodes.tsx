"use client";

import type { ChangeEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useMutation } from "@/lib/liveblocks";
import { useInvestigationStore } from "@/store/use-investigation-store";

function NodeLockTag({ lockedBy }: { lockedBy: unknown }) {
  if (typeof lockedBy !== "string" || lockedBy.length === 0) return null;

  return (
    <div className="pointer-events-none absolute -right-2 -top-8 z-20 w-max border-2 border-black bg-white px-2 py-1 font-mono text-[9px] font-black uppercase tracking-[0.08em] text-black shadow-[2px_2px_0_black] dark:border dark:border-[#FF3131] dark:bg-black dark:text-[#FF3131] dark:shadow-[0_0_7px_rgba(255,49,49,0.6)]">
      [ LOCKED BY {lockedBy} ]
    </div>
  );
}

function StickyNoteCard({
  data,
  onChange,
}: {
  data: NodeProps["data"];
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  const text =
    typeof data.text === "string"
      ? data.text
      : typeof data.label === "string"
        ? data.label
        : "";

  return (
    <div className="relative h-40 w-40 border-2 border-[var(--ink)] bg-[var(--accent)] p-3 pt-5 shadow-[4px_4px_0_var(--ink)] rounded-none sm:h-48 sm:w-48 sm:p-4 sm:pt-6">
      <NodeLockTag lockedBy={data.lockedBy} />
      <Handle
        className="w-3 h-3 bg-black border-2 border-black rounded-none dark:w-2 dark:h-2 dark:border-[#00FF41] dark:shadow-[0_0_5px_#00FF41] absolute -top-2"
        position={Position.Top}
        type="target"
      />
      <div className="absolute left-1/2 top-[-10px] h-5 w-16 -translate-x-1/2 border-2 border-[var(--ink)] bg-[var(--panel)] shadow-[2px_2px_0_var(--ink)] rounded-none" />
      <textarea
        value={text}
        onChange={onChange}
        className="nodrag nopan h-full w-full resize-none border-0 bg-transparent font-mono text-sm leading-tight text-[var(--ink)] outline-none placeholder:text-[var(--ink)]/50 rounded-none"
        placeholder="TYPE FACT..."
        aria-label="Sticky note text"
      />
      <Handle
        className="w-3 h-3 bg-black border-2 border-black rounded-none dark:w-2 dark:h-2 dark:border-[#00FF41] dark:shadow-[0_0_5px_#00FF41] absolute -bottom-2"
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
}

export function StickyNoteNode({ id, data }: NodeProps) {
  const updateNodeData = useInvestigationStore((state) => state.updateNodeData);

  return (
    <StickyNoteCard
      data={data}
      onChange={(event) => updateNodeData(id, { text: event.target.value })}
    />
  );
}

export function LiveStickyNoteNode({ id, data }: NodeProps) {
  const updateNodeData = useMutation(
    ({ storage }, nodeId: string, text: string) => {
      const liveNodes = storage.get("nodes");
      const nodeIndex = liveNodes.findIndex((node) => node.id === nodeId);
      if (nodeIndex === -1) return;

      const node = liveNodes.get(nodeIndex);
      if (!node) return;

      liveNodes.set(nodeIndex, {
        ...node,
        data: {
          ...node.data,
          text,
        },
      });
    },
    [],
  );

  return (
    <StickyNoteCard
      data={data}
      onChange={(event) => updateNodeData(id, event.target.value)}
    />
  );
}

export function PolaroidNode({ data }: NodeProps) {
  const caption = typeof data.caption === "string" ? data.caption : "UNTITLED";

  return (
    <div className="relative w-44 border-2 border-[var(--ink)] bg-[var(--panel)] p-3 pb-4 shadow-[4px_4px_0_var(--ink)] rounded-none sm:w-56">
      <NodeLockTag lockedBy={data.lockedBy} />
      <Handle
        className="w-3 h-3 bg-black border-2 border-black rounded-none dark:w-2 dark:h-2 dark:border-[#00FF41] dark:shadow-[0_0_5px_#00FF41] absolute -top-2"
        position={Position.Top}
        type="target"
      />
      <div className="flex aspect-square items-center justify-center border-2 border-[var(--ink)] bg-[var(--paper)] font-mono text-xs uppercase rounded-none">
        Image Placeholder
      </div>
      <div className="mt-3 border-t-2 border-[var(--ink)] pt-2 text-center font-mono text-xs font-bold uppercase tracking-normal">
        {caption}
      </div>
      <Handle
        className="w-3 h-3 bg-black border-2 border-black rounded-none dark:w-2 dark:h-2 dark:border-[#00FF41] dark:shadow-[0_0_5px_#00FF41] absolute -bottom-2"
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
}
