"use client";

import type { ReactNode } from "react";

export type InvestigationCardTone =
  | "neutral"
  | "call"
  | "person"
  | "location"
  | "evidence"
  | "finding"
  | "record"
  | "suspect";

export function InvestigationCard({
  eyebrow,
  title,
  subtitle,
  metadata,
  tone = "neutral",
  primary = false,
  compact = false,
  className = "",
  leaderSide,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  metadata?: string;
  tone?: InvestigationCardTone;
  primary?: boolean;
  compact?: boolean;
  className?: string;
  leaderSide?: "left" | "right";
  children?: ReactNode;
}) {
  return (
    <div
      className={`case-replay-investigation-card ${className}`.trim()}
      data-tone={tone}
      data-primary={primary}
      data-compact={compact}
      data-leader-side={leaderSide}
    >
      {eyebrow && <span className="case-replay-card-eyebrow">{eyebrow}</span>}
      <strong className="case-replay-card-title">{title}</strong>
      {subtitle && <span className="case-replay-card-subtitle">{subtitle}</span>}
      {metadata && <small className="case-replay-card-metadata">{metadata}</small>}
      {children}
    </div>
  );
}
