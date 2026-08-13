import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthVisualState =
  | "idle"
  | "checking_support"
  | "requesting"
  | "awaiting_authenticator"
  | "verifying"
  | "loading_profile"
  | "success"
  | "denied"
  | "cancelled"
  | "unsupported"
  | "error";

export type CrimeLensProfile = {
  user_id: string;
  agent_id: string;
  display_name: string;
  role: string;
  clearance: string;
  active: boolean;
};

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
};

export type ClassifiedAuthError = {
  state: Extract<
    AuthVisualState,
    "cancelled" | "unsupported" | "denied" | "error"
  >;
  message: string;
};

const cancellationCodes = new Set([
  "ERROR_CEREMONY_ABORTED",
  "AbortError",
  "NotAllowedError",
]);

const unsupportedCodes = new Set([
  "passkey_disabled",
  "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",
  "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",
  "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",
  "NotSupportedError",
  "SecurityError",
]);

const deniedCodes = new Set([
  "webauthn_credential_not_found",
  "webauthn_challenge_not_found",
  "webauthn_challenge_expired",
  "webauthn_verification_failed",
  "email_not_confirmed",
  "phone_not_confirmed",
  "user_banned",
]);

export function browserSupportsPasskeys(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
      window.isSecureContext &&
      typeof window.PublicKeyCredential !== "undefined" &&
      navigator.credentials,
  );
}

export function classifyPasskeyError(error: unknown): ClassifiedAuthError {
  const candidate =
    typeof error === "object" && error !== null ? (error as ErrorLike) : {};
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const message =
    typeof candidate.message === "string" ? candidate.message : "";
  const status = typeof candidate.status === "number" ? candidate.status : 0;

  if (cancellationCodes.has(code) || cancellationCodes.has(name)) {
    return {
      state: "cancelled",
      message: "Authentication cancelled // no session created",
    };
  }

  if (
    unsupportedCodes.has(code) ||
    unsupportedCodes.has(name) ||
    /does not support webauthn|invalid rp|invalid domain/i.test(message)
  ) {
    return {
      state: "unsupported",
      message:
        "No compatible authenticator // use a supported device or security key",
    };
  }

  if (
    deniedCodes.has(code) ||
    (status >= 400 && status < 500 && status !== 408 && status !== 429)
  ) {
    return {
      state: "denied",
      message: "Identity not verified // access denied",
    };
  }

  return {
    state: "error",
    message: "Authentication service unavailable // retry connection",
  };
}

export const authProgress: Record<AuthVisualState, number> = {
  idle: 0,
  checking_support: 10,
  requesting: 25,
  awaiting_authenticator: 50,
  verifying: 75,
  loading_profile: 90,
  success: 100,
  denied: 0,
  cancelled: 0,
  unsupported: 0,
  error: 0,
};

export async function loadAuthorizedProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<CrimeLensProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,agent_id,display_name,role,clearance,active")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("AUTHORIZED_PROFILE_NOT_FOUND");

  const profile = data as CrimeLensProfile;
  if (!profile.active) throw new Error("AUTHORIZED_PROFILE_INACTIVE");
  return profile;
}
