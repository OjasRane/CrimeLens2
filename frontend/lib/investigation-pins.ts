import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "./supabase-browser";

export const PIN_CATEGORIES = [
  "crime_scene",
  "evidence",
  "cctv",
  "suspect_sighting",
  "witness",
  "point_of_interest",
  "lead",
  "custom",
] as const;

export type InvestigationPinCategory = (typeof PIN_CATEGORIES)[number];

export type InvestigationPin = {
  id: string;
  investigationId: string;
  latitude: number;
  longitude: number;
  title: string;
  category: InvestigationPinCategory;
  description?: string | null;
  occurredAt?: string | null;
  linkedEvidenceId?: string | null;
  linkedSuspectId?: string | null;
  linkedTimelineEventId?: string | null;
  createdBy: string;
  createdByName: string;
  createdByAgentId: string;
  createdAt: string;
  updatedAt: string;
  source: "user";
  canEdit: boolean;
  canDelete: boolean;
};

export type InvestigationPinFormValues = {
  title: string;
  category: InvestigationPinCategory;
  description: string;
  occurredAt: string;
  linkedEvidenceId: string;
  linkedSuspectId: string;
  linkedTimelineEventId: string;
};

export type InvestigationPinCreateInput = InvestigationPinFormValues & {
  latitude: number;
  longitude: number;
};

export type InvestigationPinUpdateInput = InvestigationPinFormValues;

export const PIN_CATEGORY_DETAILS: Record<
  InvestigationPinCategory,
  { label: string; shortLabel: string; color: string }
> = {
  crime_scene: { label: "Crime Scene", shortLabel: "CS", color: "#FF4D55" },
  evidence: { label: "Evidence", shortLabel: "EV", color: "#D4A900" },
  cctv: { label: "CCTV", shortLabel: "CV", color: "#7C83FF" },
  suspect_sighting: {
    label: "Suspect Sighting",
    shortLabel: "SS",
    color: "#E54B4B",
  },
  witness: { label: "Witness", shortLabel: "WT", color: "#238FCC" },
  point_of_interest: {
    label: "Point of Interest",
    shortLabel: "PO",
    color: "#8A949B",
  },
  lead: { label: "Lead", shortLabel: "LD", color: "#D97706" },
  custom: { label: "Custom", shortLabel: "CU", color: "#8B5CC7" },
};

const apiBase = (
  process.env.NEXT_PUBLIC_CRIMELENS_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export class InvestigationPinApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "InvestigationPinApiError";
  }
}

async function getAccessToken(): Promise<string> {
  if (!isSupabaseBrowserConfigured) {
    throw new InvestigationPinApiError(
      "Authenticated Supabase session required for investigation pins",
      401,
    );
  }

  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error || !data.session?.access_token) {
    throw new InvestigationPinApiError(
      "Authenticated investigator session required",
      401,
    );
  }
  return data.session.access_token;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      detail?: string | Array<{ msg?: string }>;
    };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail.map((item) => item.msg).filter(Boolean).join(" // ");
    }
  } catch {
    // The HTTP status below still gives the investigator actionable feedback.
  }
  return `Investigation pin request failed (${response.status})`;
}

async function pinRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new InvestigationPinApiError(await readApiError(response), response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function normalizeFormValues(values: InvestigationPinFormValues) {
  return {
    title: values.title.trim(),
    category: values.category,
    description: values.description.trim() || null,
    occurredAt: values.occurredAt
      ? new Date(values.occurredAt).toISOString()
      : null,
    linkedEvidenceId: values.linkedEvidenceId || null,
    linkedSuspectId: values.linkedSuspectId || null,
    linkedTimelineEventId: values.linkedTimelineEventId || null,
  };
}

export function listInvestigationPins(investigationId: string, signal?: AbortSignal) {
  return pinRequest<InvestigationPin[]>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/pins`,
    { signal },
  );
}

export function createInvestigationPin(
  investigationId: string,
  input: InvestigationPinCreateInput,
) {
  return pinRequest<InvestigationPin>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/pins`,
    {
      method: "POST",
      body: JSON.stringify({
        ...normalizeFormValues(input),
        latitude: input.latitude,
        longitude: input.longitude,
      }),
    },
  );
}

export function updateInvestigationPin(
  investigationId: string,
  pinId: string,
  input: InvestigationPinUpdateInput,
) {
  return pinRequest<InvestigationPin>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/pins/${encodeURIComponent(pinId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(normalizeFormValues(input)),
    },
  );
}

export function deleteInvestigationPin(investigationId: string, pinId: string) {
  return pinRequest<void>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/pins/${encodeURIComponent(pinId)}`,
    { method: "DELETE" },
  );
}

export function formatCoordinate(
  value: number,
  axis: "latitude" | "longitude",
): string {
  const positive = axis === "latitude" ? "N" : "E";
  const negative = axis === "latitude" ? "S" : "W";
  return `${Math.abs(value).toFixed(5)}° ${value < 0 ? negative : positive}`;
}

export function toLocalDateTimeInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
