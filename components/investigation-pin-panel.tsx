"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  formatCoordinate,
  PIN_CATEGORIES,
  PIN_CATEGORY_DETAILS,
  toLocalDateTimeInput,
  type InvestigationPin,
  type InvestigationPinFormValues,
} from "@/lib/investigation-pins";

export type PinLinkOption = { id: string; label: string };

type PinLinkOptions = {
  evidence: PinLinkOption[];
  suspects: PinLinkOption[];
  timeline: PinLinkOption[];
};

const fieldClass =
  "min-h-11 w-full rounded-none border-2 border-[var(--ink)] bg-[var(--panel)] px-2 py-2 text-[var(--ink)] outline-none placeholder:text-[var(--dim)] focus-visible:ring-4 focus-visible:ring-[var(--accent)]";
const actionClass =
  "min-h-11 border-2 border-[var(--ink)] px-3 py-2 text-left transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50";

export function InvestigationPinEditor({
  mode,
  latitude,
  longitude,
  pin,
  linkOptions,
  isSaving,
  error,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit";
  latitude: number;
  longitude: number;
  pin?: InvestigationPin;
  linkOptions: PinLinkOptions;
  isSaving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (values: InvestigationPinFormValues) => void;
}) {
  const initialValues = useMemo<InvestigationPinFormValues>(
    () => ({
      title: pin?.title ?? "",
      category: pin?.category ?? "point_of_interest",
      description: pin?.description ?? "",
      occurredAt: toLocalDateTimeInput(pin?.occurredAt),
      linkedEvidenceId: pin?.linkedEvidenceId ?? "",
      linkedSuspectId: pin?.linkedSuspectId ?? "",
      linkedTimelineEventId: pin?.linkedTimelineEventId ?? "",
    }),
    [pin],
  );
  const [values, setValues] = useState(initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function setField<K extends keyof InvestigationPinFormValues>(
    field: K,
    value: InvestigationPinFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    if (validationError) setValidationError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.title.trim()) {
      setValidationError("PIN TITLE IS REQUIRED");
      titleRef.current?.focus();
      return;
    }
    onSave(values);
  }

  return (
    <aside
      aria-label={mode === "create" ? "New investigation pin" : "Edit investigation pin"}
      className="absolute bottom-3 left-3 right-3 z-50 max-h-[calc(100%-1.5rem)] overflow-y-auto border-4 border-[var(--ink)] bg-[var(--paper)] p-3 font-mono text-[10px] font-black uppercase text-[var(--ink)] shadow-[6px_6px_0_var(--ink)] md:bottom-24 md:left-auto md:right-4 md:top-3 md:max-h-none md:w-[min(390px,calc(100%-1.5rem))] md:text-xs"
    >
      <div className="mb-3 border-b-4 border-[var(--ink)] pb-2">
        <div className="text-[9px] opacity-60">
          {mode === "create" ? "NEW LOCATION ANNOTATION" : `EDIT // ${pin?.id.slice(0, 8)}`}
        </div>
        <h2 className="font-serif text-xl font-black leading-none">
          {mode === "create" ? "New Investigation Pin" : "Edit Investigation Pin"}
        </h2>
      </div>

      <form className="grid gap-3" onSubmit={submit}>
        <label className="grid gap-1">
          <span>Pin title *</span>
          <input
            ref={titleRef}
            value={values.title}
            maxLength={120}
            onChange={(event) => setField("title", event.target.value)}
            className={fieldClass}
            placeholder="ABANDONED WAREHOUSE"
            autoComplete="off"
          />
        </label>

        <label className="grid gap-1">
          <span>Category *</span>
          <select
            value={values.category}
            onChange={(event) =>
              setField(
                "category",
                event.target.value as InvestigationPinFormValues["category"],
              )
            }
            className={fieldClass}
          >
            {PIN_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PIN_CATEGORY_DETAILS[category].label.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2" aria-label="Captured map coordinates">
          <div className="border-2 border-[var(--ink)] bg-[var(--panel)] p-2">
            <div className="text-[9px] opacity-60">Latitude</div>
            {formatCoordinate(latitude, "latitude")}
          </div>
          <div className="border-2 border-[var(--ink)] bg-[var(--panel)] p-2">
            <div className="text-[9px] opacity-60">Longitude</div>
            {formatCoordinate(longitude, "longitude")}
          </div>
        </div>

        <label className="grid gap-1">
          <span>Investigator note</span>
          <textarea
            value={values.description}
            maxLength={2000}
            rows={4}
            onChange={(event) => setField("description", event.target.value)}
            className={`${fieldClass} resize-y normal-case`}
            placeholder="Possible secondary entry point identified during review."
          />
          <span className="text-right text-[9px] opacity-50">
            {values.description.length}/2000
          </span>
        </label>

        <label className="grid gap-1">
          <span>Date / time (optional)</span>
          <input
            type="datetime-local"
            value={values.occurredAt}
            onChange={(event) => setField("occurredAt", event.target.value)}
            className={fieldClass}
          />
        </label>

        <div className="grid gap-2 border-t-2 border-[var(--ink)] pt-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span>Linked evidence</span>
            <select
              value={values.linkedEvidenceId}
              onChange={(event) => setField("linkedEvidenceId", event.target.value)}
              className={fieldClass}
            >
              <option value="">NONE</option>
              {linkOptions.evidence.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span>Linked suspect</span>
            <select
              value={values.linkedSuspectId}
              onChange={(event) => setField("linkedSuspectId", event.target.value)}
              className={fieldClass}
            >
              <option value="">NONE</option>
              {linkOptions.suspects.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1">
          <span>Linked timeline event</span>
          <select
            value={values.linkedTimelineEventId}
            onChange={(event) =>
              setField("linkedTimelineEventId", event.target.value)
            }
            className={fieldClass}
          >
            <option value="">NONE</option>
            {linkOptions.timeline.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {validationError || error ? (
          <div role="alert" className="border-2 border-[var(--danger)] bg-[var(--panel)] p-2 text-[var(--danger)]">
            [ {validationError ?? error} ]
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 border-t-4 border-[var(--ink)] pt-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className={`${actionClass} bg-[var(--panel)] text-[var(--ink)]`}
          >
            [ Cancel ]
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`${actionClass} bg-[var(--accent)] text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`}
          >
            [ {isSaving ? "Saving..." : mode === "create" ? "Save Pin" : "Update Pin"} ]
          </button>
        </div>
      </form>
    </aside>
  );
}

function formatPinTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function InvestigationPinDetails({
  pin,
  linkOptions,
  onClose,
  onEdit,
  onDelete,
}: {
  pin: InvestigationPin;
  linkOptions: PinLinkOptions;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const category = PIN_CATEGORY_DETAILS[pin.category];
  const lookup = (options: PinLinkOption[], id?: string | null) =>
    options.find((option) => option.id === id)?.label ?? id;

  return (
    <aside className="absolute bottom-3 left-3 right-3 z-[45] max-h-[calc(100%-1.5rem)] overflow-y-auto border-4 border-[var(--ink)] bg-[var(--paper)] p-3 font-mono text-[10px] font-black uppercase text-[var(--ink)] shadow-[6px_6px_0_var(--ink)] md:bottom-24 md:left-auto md:right-4 md:top-3 md:max-h-none md:w-[min(370px,calc(100%-1.5rem))] md:text-xs">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close investigation pin details"
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] focus-visible:ring-4 focus-visible:ring-[var(--accent)]"
      >
        [ X ]
      </button>
      <div className="mb-3 border-b-4 border-[var(--ink)] pb-2 pr-12">
        <div className="flex items-center gap-2 text-[9px]" style={{ color: category.color }}>
          <span className="inline-block h-2.5 w-2.5 rotate-45 border border-current bg-current" />
          {category.label} // USER PIN
        </div>
        <h2 className="font-serif text-xl font-black normal-case leading-none">
          {pin.title}
        </h2>
        <div className="mt-1 opacity-60">
          {formatPinTimestamp(pin.occurredAt ?? pin.createdAt)}
        </div>
      </div>

      {pin.description ? (
        <p className="border-2 border-[var(--ink)] bg-[var(--panel)] p-2 normal-case leading-tight">
          {pin.description}
        </p>
      ) : null}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="border-2 border-[var(--ink)] bg-[var(--panel)] p-2">
          <div className="text-[9px] opacity-60">Latitude</div>
          {formatCoordinate(pin.latitude, "latitude")}
        </div>
        <div className="border-2 border-[var(--ink)] bg-[var(--panel)] p-2">
          <div className="text-[9px] opacity-60">Longitude</div>
          {formatCoordinate(pin.longitude, "longitude")}
        </div>
      </div>

      <div className="mt-2 border-2 border-[var(--ink)] bg-[var(--panel)] p-2">
        <div className="text-[9px] opacity-60">Created by</div>
        {pin.createdByName} // {pin.createdByAgentId}
      </div>

      {pin.linkedEvidenceId || pin.linkedSuspectId || pin.linkedTimelineEventId ? (
        <dl className="mt-2 grid gap-1 border-2 border-[var(--ink)] bg-[var(--panel)] p-2">
          {pin.linkedEvidenceId ? (
            <div><dt className="inline opacity-60">EVIDENCE // </dt><dd className="inline">{lookup(linkOptions.evidence, pin.linkedEvidenceId)}</dd></div>
          ) : null}
          {pin.linkedSuspectId ? (
            <div><dt className="inline opacity-60">SUSPECT // </dt><dd className="inline">{lookup(linkOptions.suspects, pin.linkedSuspectId)}</dd></div>
          ) : null}
          {pin.linkedTimelineEventId ? (
            <div><dt className="inline opacity-60">TIMELINE // </dt><dd className="inline">{lookup(linkOptions.timeline, pin.linkedTimelineEventId)}</dd></div>
          ) : null}
        </dl>
      ) : null}

      {pin.canEdit || pin.canDelete ? (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t-4 border-[var(--ink)] pt-3">
          <button
            type="button"
            onClick={onEdit}
            disabled={!pin.canEdit}
            className={`${actionClass} bg-[var(--accent)] text-[var(--ink)] shadow-[3px_3px_0_var(--ink)]`}
          >
            [ Edit Pin ]
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!pin.canDelete}
            className={`${actionClass} bg-[var(--danger)] text-white shadow-[3px_3px_0_var(--ink)]`}
          >
            [ Delete Pin ]
          </button>
        </div>
      ) : null}
    </aside>
  );
}

export function InvestigationPinDeleteDialog({
  pin,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: {
  pin: InvestigationPin;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4 font-mono text-xs font-black uppercase" role="alertdialog" aria-modal="true" aria-labelledby="delete-pin-title" aria-describedby="delete-pin-description">
      <div className="w-full max-w-md border-4 border-[var(--ink)] bg-[var(--paper)] p-4 text-[var(--ink)] shadow-[7px_7px_0_var(--ink)]">
        <h2 id="delete-pin-title" className="font-serif text-2xl font-black normal-case">
          Delete Investigation Pin?
        </h2>
        <p id="delete-pin-description" className="mt-2 normal-case">
          This removes “{pin.title}” from this case. The action remains in the pin audit trail.
        </p>
        {error ? <div role="alert" className="mt-3 border-2 border-[var(--danger)] p-2 text-[var(--danger)]">[ {error} ]</div> : null}
        <div className="mt-4 grid grid-cols-2 gap-2 border-t-4 border-[var(--ink)] pt-3">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={isDeleting} className={`${actionClass} bg-[var(--panel)] text-[var(--ink)]`}>
            [ Cancel ]
          </button>
          <button type="button" onClick={onConfirm} disabled={isDeleting} className={`${actionClass} bg-[var(--danger)] text-white shadow-[3px_3px_0_var(--ink)]`}>
            [ {isDeleting ? "Deleting..." : "Delete"} ]
          </button>
        </div>
      </div>
    </div>
  );
}

export const InvestigationPinMarker = memo(function InvestigationPinMarker({
  pin,
  selected,
  placementActive,
  onSelect,
}: {
  pin: InvestigationPin;
  selected: boolean;
  placementActive: boolean;
  onSelect: (pinId: string) => void;
}) {
  const category = PIN_CATEGORY_DETAILS[pin.category];
  return (
    <div className="group relative font-mono">
      <button
        type="button"
        aria-label={`${category.label}: ${pin.title}`}
        aria-pressed={selected}
        onClick={(event) => {
          event.stopPropagation();
          if (!placementActive) onSelect(pin.id);
        }}
        className={`fatal-investigation-pin grid min-h-0 w-12 place-items-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FCD34D] ${selected ? "is-selected" : ""}`}
      >
        <span
          className="grid h-7 w-7 rotate-45 place-items-center border-2 bg-[var(--panel)] shadow-[2px_2px_0_rgba(0,0,0,0.55)]"
          style={{ borderColor: category.color, color: category.color }}
        >
          <span className="-rotate-45 text-[8px] font-black">{category.shortLabel}</span>
        </span>
        <span className="mt-1 border border-[var(--ink)] bg-[var(--paper)] px-1 text-[7px] font-black text-[var(--ink)]">
          USER
        </span>
      </button>
      <div role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-52 -translate-x-1/2 border-2 border-[var(--ink)] bg-[var(--paper)] p-2 text-[9px] font-black uppercase text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] group-hover:block group-focus-within:block">
        <div style={{ color: category.color }}>{category.label} // USER PIN</div>
        <div className="mt-1 font-serif text-sm normal-case leading-none text-[var(--ink)]">{pin.title}</div>
        <div className="mt-1 opacity-60">{formatPinTimestamp(pin.occurredAt ?? pin.createdAt)}</div>
      </div>
    </div>
  );
});

export function TemporaryInvestigationPinMarker() {
  return (
    <div className="fatal-pin-placement-marker relative grid h-14 w-14 place-items-center" aria-label="Temporary investigation pin">
      <span className="absolute inset-1 rounded-full border-2 border-[#FCD34D]" />
      <span className="absolute h-full w-px bg-[#FCD34D]" />
      <span className="absolute h-px w-full bg-[#FCD34D]" />
      <span className="relative h-5 w-5 rotate-45 border-2 border-black bg-[#FCD34D] shadow-[2px_2px_0_black]" />
    </div>
  );
}
