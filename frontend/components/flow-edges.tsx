"use client";

import type { EdgeProps } from "@xyflow/react";

export function RedStringEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps) {
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const points = [
    [sourceX, sourceY],
    [sourceX + deltaX * 0.25, sourceY + deltaY * 0.15 - 18],
    [sourceX + deltaX * 0.5, sourceY + deltaY * 0.55 + 16],
    [sourceX + deltaX * 0.75, sourceY + deltaY * 0.85 - 12],
    [targetX, targetY],
  ];
  const path = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");

  return (
    <path
      d={path}
      fill="none"
      stroke="var(--danger)"
      strokeWidth={3}
      strokeDasharray="5,5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
  );
}
