import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authProgress,
  browserSupportsPasskeys,
  classifyPasskeyError,
  loadAuthorizedProfile,
} from "./crimelens-auth";

function profileClient(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return {
    client: { from } as unknown as SupabaseClient,
    from,
    select,
    eq,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browserSupportsPasskeys", () => {
  it("accepts WebAuthn only in a secure browser context", () => {
    vi.stubGlobal("window", {
      isSecureContext: true,
      PublicKeyCredential: class PublicKeyCredential {},
    });
    vi.stubGlobal("navigator", { credentials: {} });

    expect(browserSupportsPasskeys()).toBe(true);
  });

  it("rejects an insecure production context", () => {
    vi.stubGlobal("window", {
      isSecureContext: false,
      PublicKeyCredential: class PublicKeyCredential {},
    });
    vi.stubGlobal("navigator", { credentials: {} });

    expect(browserSupportsPasskeys()).toBe(false);
  });

  it("does not claim support when WebAuthn is absent", () => {
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", { credentials: {} });

    expect(browserSupportsPasskeys()).toBe(false);
  });
});

describe("classifyPasskeyError", () => {
  it("distinguishes a cancelled ceremony", () => {
    expect(
      classifyPasskeyError({ code: "ERROR_CEREMONY_ABORTED" }).state,
    ).toBe("cancelled");
  });

  it("treats browser NotAllowedError as cancellation", () => {
    expect(classifyPasskeyError({ name: "NotAllowedError" }).state).toBe(
      "cancelled",
    );
  });

  it("distinguishes an unsupported authenticator", () => {
    expect(classifyPasskeyError({ name: "NotSupportedError" }).state).toBe(
      "unsupported",
    );
  });

  it("surfaces disabled project passkey configuration as unsupported", () => {
    expect(classifyPasskeyError({ code: "passkey_disabled" }).state).toBe(
      "unsupported",
    );
  });

  it("distinguishes verification failure from service failure", () => {
    expect(
      classifyPasskeyError({ code: "webauthn_verification_failed" }).state,
    ).toBe("denied");
  });

  it("uses service error wording for network failures", () => {
    const result = classifyPasskeyError(new TypeError("Failed to fetch"));
    expect(result.state).toBe("error");
    expect(result.message).toContain("service unavailable");
  });

  it("does not call a rate limit response an identity denial", () => {
    expect(classifyPasskeyError({ status: 429 }).state).toBe("error");
  });
});

describe("loadAuthorizedProfile", () => {
  const profile = {
    user_id: "0db89f00-6d85-45ec-a927-ae911413ece7",
    agent_id: "CR-0174",
    display_name: "A. Investigator",
    role: "investigator",
    clearance: "LEVEL AMBER",
    active: true,
  };

  it("loads agent identity and clearance from the authenticated profile row", async () => {
    const mock = profileClient({ data: profile, error: null });

    await expect(
      loadAuthorizedProfile(mock.client, profile.user_id),
    ).resolves.toEqual(profile);
    expect(mock.from).toHaveBeenCalledWith("profiles");
    expect(mock.eq).toHaveBeenCalledWith("user_id", profile.user_id);
  });

  it("does not synthesize a profile when none is authorized", async () => {
    const mock = profileClient({ data: null, error: null });

    await expect(
      loadAuthorizedProfile(mock.client, profile.user_id),
    ).rejects.toThrow("AUTHORIZED_PROFILE_NOT_FOUND");
  });

  it("rejects an inactive server-authorized profile", async () => {
    const mock = profileClient({
      data: { ...profile, active: false },
      error: null,
    });

    await expect(
      loadAuthorizedProfile(mock.client, profile.user_id),
    ).rejects.toThrow("AUTHORIZED_PROFILE_INACTIVE");
  });
});

describe("authentication progress", () => {
  it("represents ceremony state rather than a biometric confidence score", () => {
    expect(authProgress.idle).toBe(0);
    expect(authProgress.awaiting_authenticator).toBe(50);
    expect(authProgress.loading_profile).toBe(90);
    expect(authProgress.success).toBe(100);
    expect(authProgress.denied).toBe(0);
  });
});
