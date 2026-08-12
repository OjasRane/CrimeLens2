"use client";

import type {
  NormalizedLandmark,
  Options as HandsOptions,
  Results,
} from "@mediapipe/hands";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Fingerprint,
  Moon,
  ScanLine,
  ShieldAlert,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";

type HandsRuntime = {
  close: () => Promise<void>;
  onResults: (listener: (results: Results) => void) => void;
  send: (inputs: { image: HTMLVideoElement }) => Promise<void>;
  setOptions: (options: HandsOptions) => void;
};

type HandsConstructor = new (config: {
  locateFile: (file: string) => string;
}) => HandsRuntime;

declare global {
  interface Window {
    HAND_CONNECTIONS: Array<[number, number]>;
    Hands: HandsConstructor;
  }
}

type AuthState =
  | "IDLE"
  | "INITIALIZING"
  | "TRACKING"
  | "VERIFYING"
  | "SUCCESS"
  | "DENIED";

type TerminalMode = "LOGIN" | "ENROLL";
type FlashTone = "success" | "denied" | null;

const states: AuthState[] = [
  "IDLE",
  "INITIALIZING",
  "TRACKING",
  "VERIFYING",
  "SUCCESS",
  "DENIED",
];

const statusLabel: Record<AuthState, string> = {
  IDLE: "AWAITING UPLINK",
  INITIALIZING: "BOOTING SENSOR ARRAY",
  TRACKING: "ACQUIRING BIOMETRIC LOCK",
  VERIFYING: "CROSS-REFERENCING INDEX",
  SUCCESS: "CLEARANCE CONFIRMED",
  DENIED: "CLEARANCE REVOKED",
};

const panel =
  "border-4 border-black bg-white shadow-[8px_8px_0_black] " +
  "dark:border-[#EAE5C9] dark:bg-[#132E3A] dark:shadow-[8px_8px_0_#EAE5C9]";

const physicalButton =
  "border-4 border-black bg-white text-black shadow-[6px_6px_0_black] " +
  "transition-[transform,box-shadow,background-color,color] hover:bg-black hover:text-white " +
  "active:translate-x-[6px] active:translate-y-[6px] active:shadow-none " +
  "dark:border-[#EAE5C9] dark:bg-[#132E3A] dark:text-[#EAE5C9] " +
  "dark:shadow-[6px_6px_0_#EAE5C9] dark:hover:bg-[#EAE5C9] dark:hover:text-[#06141B]";

const stabilityFrameTarget = 30;
const verificationSampleTarget = 10;
const verificationSampleStride = 8;
const enrollmentSampleTarget = 10;
const enrollmentSampleStride = 8;
const handsPackageUrl =
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240";
const verificationEndpoint =
  process.env.NEXT_PUBLIC_BIOMETRIC_VERIFY_URL ??
  "http://localhost:8000/api/v1/auth/verify-kinetic";
const registrationEndpoint =
  process.env.NEXT_PUBLIC_BIOMETRIC_REGISTER_URL ??
  "http://localhost:8000/api/v1/auth/register-kinetic";

function playSuccessChime() {
  try {
    const audioContext = new AudioContext();
    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(
      0.18,
      audioContext.currentTime + 0.02,
    );
    masterGain.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime + 0.7,
    );
    masterGain.connect(audioContext.destination);

    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(masterGain);
      oscillator.start(audioContext.currentTime + index * 0.1);
      oscillator.stop(audioContext.currentTime + 0.5 + index * 0.1);
    });

    window.setTimeout(() => void audioContext.close(), 900);
  } catch {
    // Authentication must still complete when Web Audio is unavailable.
  }
}

function responseDetail(result: unknown, fallback: string) {
  if (
    typeof result === "object" &&
    result !== null &&
    "detail" in result &&
    typeof result.detail === "string"
  ) {
    return result.detail;
  }
  return fallback;
}

export function extractNormalizedVector(
  landmarks: NormalizedLandmark[],
): number[] {
  if (landmarks.length < 21) {
    throw new RangeError("A complete hand requires 21 landmarks.");
  }

  const wrist = landmarks[0];
  const middleFingerMcp = landmarks[9];
  const deltaX = middleFingerMcp.x - wrist.x;
  const deltaY = middleFingerMcp.y - wrist.y;
  const deltaZ = middleFingerMcp.z - wrist.z;
  const scale = Math.sqrt(
    deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ,
  );

  if (!Number.isFinite(scale) || scale <= Number.EPSILON) {
    throw new RangeError("Hand landmark scale must be greater than zero.");
  }

  return landmarks.slice(0, 21).flatMap((landmark) => [
    (landmark.x - wrist.x) / scale,
    (landmark.y - wrist.y) / scale,
    (landmark.z - wrist.z) / scale,
  ]);
}

export function KineticTerminal() {
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"LOGIN" | "ENROLL">("LOGIN");
  const [provisionToken, setProvisionToken] = useState("");
  const [authState, setAuthState] = useState<AuthState>("IDLE");
  const [flashTone, setFlashTone] = useState<FlashTone>(null);
  const [agentId, setAgentId] = useState("");
  const [authError, setAuthError] = useState("");
  const [stabilityProgress, setStabilityProgress] = useState(0);
  const [verificationSampleCount, setVerificationSampleCount] = useState(0);
  const [enrollmentSampleCount, setEnrollmentSampleCount] = useState(0);
  const [handsScriptReady, setHandsScriptReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [webcamAttempt, setWebcamAttempt] = useState(0);
  const webcamRef = useRef<Webcam | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const authStateRef = useRef<AuthState>("IDLE");
  const modeRef = useRef<TerminalMode>("LOGIN");
  const agentIdRef = useRef("");
  const provisionTokenRef = useRef("");
  const isDarkRef = useRef(true);
  const framesLocked = useRef(0);
  const framesSinceVerificationSample = useRef(0);
  const framesSinceEnrollmentSample = useRef(0);
  const verificationSamples = useRef<number[][]>([]);
  const enrollmentSamples = useRef<number[][]>([]);
  const verificationTriggered = useRef(false);
  const redirectTimeout = useRef<number | null>(null);
  const trackerTeardown = useRef<Promise<void>>(Promise.resolve());
  const routerRef = useRef(router);

  useEffect(() => setMounted(true), []);

  useEffect(
    () => () => {
      if (redirectTimeout.current !== null) {
        window.clearTimeout(redirectTimeout.current);
      }
    },
    [],
  );

  useEffect(() => {
    authStateRef.current = authState;
  }, [authState]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    agentIdRef.current = agentId;
  }, [agentId]);

  useEffect(() => {
    provisionTokenRef.current = provisionToken;
  }, [provisionToken]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  const trackingActive =
    authState === "INITIALIZING" || authState === "TRACKING";

  const resetCaptureProgress = () => {
    framesLocked.current = 0;
    framesSinceVerificationSample.current = 0;
    framesSinceEnrollmentSample.current = 0;
    verificationSamples.current = [];
    enrollmentSamples.current = [];
    verificationTriggered.current = false;
    setStabilityProgress(0);
    setVerificationSampleCount(0);
    setEnrollmentSampleCount(0);
  };

  const initializeScan = () => {
    resetCaptureProgress();
    setFlashTone(null);
    setAuthError("");
    authStateRef.current = "INITIALIZING";
    setAuthState("INITIALIZING");
  };

  const handleModeToggle = () => {
    const nextMode: TerminalMode = modeRef.current === "LOGIN" ? "ENROLL" : "LOGIN";
    modeRef.current = nextMode;
    setMode(nextMode);
    initializeScan();
  };

  const handleWebcamReady = () => {
    setCameraError("");
    if (authStateRef.current === "IDLE") initializeScan();
  };

  const handleWebcamError = (error: string | DOMException) => {
    const errorName = typeof error === "string" ? error : error.name;
    const message =
      errorName === "NotAllowedError" || errorName === "PermissionDeniedError"
        ? "CAMERA ACCESS BLOCKED // ENABLE CAMERA PERMISSION IN THE BROWSER"
        : errorName === "NotFoundError" || errorName === "DevicesNotFoundError"
          ? "NO CAMERA DEVICE DETECTED"
          : "CAMERA FEED UNAVAILABLE";

    resetCaptureProgress();
    setCameraError(message);
    authStateRef.current = "IDLE";
    setAuthState("IDLE");
  };

  const retryCamera = () => {
    setCameraError("");
    setAuthError("");
    resetCaptureProgress();
    setWebcamAttempt((attempt) => attempt + 1);
  };

  const handleEnrollmentComplete = () => {
    modeRef.current = "LOGIN";
    setMode("LOGIN");
    provisionTokenRef.current = "";
    setProvisionToken("");
    initializeScan();
  };

  useEffect(() => {
    if (!trackingActive || !handsScriptReady || cameraError) return;

    let disposed = false;
    let handsToClose: HandsRuntime | null = null;
    let frameRequestId: number | null = null;
    let activeSend: Promise<void> | null = null;
    const previousTeardown = trackerTeardown.current;

    const setupTracker = async () => {
      await previousTeardown.catch(() => undefined);
      if (disposed) return;

      const video = webcamRef.current?.video;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      resetCaptureProgress();

      const hands = new window.Hands({
        locateFile: (file) => `${handsPackageUrl}/${file}`,
      });
      handsToClose = hands;

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      const denyAccess = (message: string) => {
        resetCaptureProgress();
        setAuthError(message);
        setFlashTone("denied");
        authStateRef.current = "DENIED";
        setAuthState("DENIED");
      };

      const postLoginCandidate = async (candidateSamples: number[][]) => {
        try {
          const response = await fetch(verificationEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agent_id: agentIdRef.current,
              candidate_samples: candidateSamples,
            }),
          });
          const result: unknown = await response.json().catch(() => null);

          if (
            response.ok &&
            typeof result === "object" &&
            result !== null &&
            "status" in result &&
            result.status === "VERIFIED" &&
            "access_token" in result &&
            typeof result.access_token === "string"
          ) {
            window.sessionStorage.setItem(
              "kinetic_access_token",
              result.access_token,
            );
            setFlashTone("success");
            playSuccessChime();
            authStateRef.current = "SUCCESS";
            setAuthState("SUCCESS");
            redirectTimeout.current = window.setTimeout(
              () => routerRef.current.push("/dashboard"),
              900,
            );
            return;
          }

          denyAccess(responseDetail(result, "Biometric signature rejected"));
        } catch {
          denyAccess("Verification service unavailable");
        }
      };

      const postEnrollmentSamples = async (samples: number[][]) => {
        try {
          const response = await fetch(registrationEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provisioning_token: provisionTokenRef.current,
              samples,
            }),
          });
          const result: unknown = await response.json().catch(() => null);

          if (
            response.ok &&
            typeof result === "object" &&
            result !== null &&
            "status" in result &&
            result.status === "SUCCESS"
          ) {
            setFlashTone("success");
            playSuccessChime();
            authStateRef.current = "SUCCESS";
            setAuthState("SUCCESS");
            return;
          }

          denyAccess(responseDetail(result, "Enrollment token rejected"));
        } catch {
          denyAccess("Enrollment service unavailable");
        }
      };

      const handleResults = (results: Results) => {
        if (disposed) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const renderWidth = video.videoWidth || video.clientWidth;
        const renderHeight = video.videoHeight || video.clientHeight;
        if (renderWidth > 0 && renderHeight > 0) {
          if (canvas.width !== renderWidth) canvas.width = renderWidth;
          if (canvas.height !== renderHeight) canvas.height = renderHeight;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        const landmarks = results.multiHandLandmarks[0];

        if (!landmarks) {
          if (
            framesLocked.current !== 0 ||
            enrollmentSamples.current.length !== 0
          ) {
            resetCaptureProgress();
          }
          return;
        }

        const wireColor = isDarkRef.current ? "#EAE5C9" : "#000000";
        context.strokeStyle = wireColor;
        context.lineWidth = 3;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        for (const [startIndex, endIndex] of window.HAND_CONNECTIONS) {
          const start = landmarks[startIndex];
          const end = landmarks[endIndex];
          context.moveTo(start.x * canvas.width, start.y * canvas.height);
          context.lineTo(end.x * canvas.width, end.y * canvas.height);
        }
        context.stroke();

        context.fillStyle = wireColor;
        for (const landmark of landmarks) {
          context.beginPath();
          context.arc(
            landmark.x * canvas.width,
            landmark.y * canvas.height,
            4,
            0,
            Math.PI * 2,
          );
          context.fill();
        }

        if (authStateRef.current === "INITIALIZING") {
          authStateRef.current = "TRACKING";
          setAuthState("TRACKING");
        }

        if (framesLocked.current < stabilityFrameTarget) {
          framesLocked.current += 1;
          setStabilityProgress(
            (framesLocked.current / stabilityFrameTarget) * 100,
          );
        }

        if (
          framesLocked.current !== stabilityFrameTarget ||
          verificationTriggered.current
        ) {
          return;
        }

        if (modeRef.current === "LOGIN") {
          if (!agentIdRef.current.trim()) return;

          if (verificationSamples.current.length < verificationSampleTarget) {
            framesSinceVerificationSample.current += 1;
            const shouldCapture =
              verificationSamples.current.length === 0 ||
              framesSinceVerificationSample.current >= verificationSampleStride;

            if (shouldCapture) {
              try {
                verificationSamples.current.push(
                  extractNormalizedVector(landmarks),
                );
                framesSinceVerificationSample.current = 0;
                setVerificationSampleCount(verificationSamples.current.length);
              } catch {
                resetCaptureProgress();
                return;
              }
            }
          }

          if (verificationSamples.current.length < verificationSampleTarget) {
            return;
          }

          verificationTriggered.current = true;
          authStateRef.current = "VERIFYING";
          setAuthState("VERIFYING");
          void postLoginCandidate([...verificationSamples.current]);
          return;
        }

        if (enrollmentSamples.current.length < enrollmentSampleTarget) {
          framesSinceEnrollmentSample.current += 1;
          const shouldCapture =
            enrollmentSamples.current.length === 0 ||
            framesSinceEnrollmentSample.current >= enrollmentSampleStride;

          if (shouldCapture) {
            try {
              enrollmentSamples.current.push(
                extractNormalizedVector(landmarks),
              );
              framesSinceEnrollmentSample.current = 0;
              setEnrollmentSampleCount(enrollmentSamples.current.length);
            } catch {
              resetCaptureProgress();
              return;
            }
          }
        }

        if (
          enrollmentSamples.current.length === enrollmentSampleTarget &&
          provisionTokenRef.current.trim()
        ) {
          verificationTriggered.current = true;
          authStateRef.current = "VERIFYING";
          setAuthState("VERIFYING");
          void postEnrollmentSamples([...enrollmentSamples.current]);
        }
      };

      hands.onResults(handleResults);

      // react-webcam already owns the authorized MediaStream. Feeding that
      // video directly to MediaPipe avoids a second getUserMedia request from
      // Camera Utils, which can fail with NotAllowedError even after approval.
      const processFrame = async () => {
        if (disposed) return;

        if (!activeSend && video.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
          const send = hands.send({ image: video });
          activeSend = send;
          try {
            await send;
          } catch {
            if (!disposed) resetCaptureProgress();
          } finally {
            if (activeSend === send) activeSend = null;
          }
        }

        if (!disposed) frameRequestId = window.requestAnimationFrame(processFrame);
      };

      frameRequestId = window.requestAnimationFrame(processFrame);
    };

    void setupTracker().catch(() => {
      if (!disposed) {
        resetCaptureProgress();
        setAuthError("Sensor initialization failed");
      }
    });

    return () => {
      disposed = true;
      const teardownBase = trackerTeardown.current;

      trackerTeardown.current = teardownBase
        .catch(() => undefined)
        .then(async () => {
          if (frameRequestId !== null) {
            window.cancelAnimationFrame(frameRequestId);
            frameRequestId = null;
          }

          const pendingSend = activeSend;
          if (pendingSend) await pendingSend.catch(() => undefined);

          await handsToClose?.close().catch(() => undefined);
          handsToClose = null;
        });

      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (canvas) context?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [cameraError, handsScriptReady, trackingActive]);

  const displayStatus = (() => {
    if (authState !== "TRACKING" || stabilityProgress < 100) {
      return statusLabel[authState];
    }
    if (mode === "LOGIN" && !agentId.trim()) return "ENTER AGENT ID TO VERIFY";
    if (mode === "LOGIN" && verificationSampleCount < verificationSampleTarget) {
      return `REPRODUCE PRIVATE GESTURE ${verificationSampleCount}/${verificationSampleTarget}`;
    }
    if (mode === "ENROLL" && enrollmentSampleCount < enrollmentSampleTarget) {
      return `RECORD PRIVATE GESTURE ${enrollmentSampleCount}/${enrollmentSampleTarget}`;
    }
    if (mode === "ENROLL" && !provisionToken.trim()) {
      return "AWAITING PROVISIONING TOKEN";
    }
    return statusLabel[authState];
  })();

  return (
    <main className="login-terminal min-h-screen w-full bg-[#F4F4F0] bg-[radial-gradient(#000000_1px,transparent_1px)] [background-size:24px_24px] font-mono uppercase tracking-[0.18em] text-black dark:bg-[#06141B] dark:bg-[radial-gradient(#EAE5C9_1px,transparent_1px)] dark:[background-size:24px_24px] dark:text-[#EAE5C9]">
      <Script
        src={`${handsPackageUrl}/hands.js`}
        strategy="afterInteractive"
        onReady={() => setHandsScriptReady(true)}
      />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-5 py-10 sm:px-8">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="bg-[#F4F4F0] px-2 py-1 tracking-[0.32em] dark:bg-[#06141B]">
            SECURE // {isDark ? "EVIDENCE-LOCKER" : "EVIDENCE-BOARD"} MODE
          </span>
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`flex items-center gap-2 px-3 py-2 text-[10px] tracking-[0.2em] ${physicalButton}`}
          >
            {isDark ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
            {isDark ? "LIGHT" : "DARK"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <section className={`flex flex-col gap-6 p-6 sm:p-8 ${panel}`}>
            <header className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[9px] font-bold text-black dark:text-[#EAE5C9]">
                <span className="inline-block h-2 w-2 animate-pulse bg-black dark:bg-[#EAE5C9]" />
                LIVE FEED // ROOT ACCESS // {mode}
              </div>
              <h1 className="font-mono text-xl font-bold leading-tight tracking-[0.12em] sm:text-2xl">
                GLOBAL INTEL INDEX
                <br />
                <span className="text-black dark:text-[#EAE5C9]">
                  // CLEARANCE TERMINAL V5.0
                </span>
              </h1>
            </header>

            <button
              type="button"
              onClick={handleModeToggle}
              aria-label={`Switch to ${mode === "LOGIN" ? "enrollment" : "login"} mode`}
              className={`w-full px-4 py-3 text-[10px] font-bold tracking-[0.16em] ${physicalButton}`}
            >
              {mode === "LOGIN"
                ? "[ VERIFY EXISTING SIGNATURE ]"
                : "[ ENROLL NEW BASELINE ]"}
            </button>

            <p className="border-2 border-dashed border-black bg-white px-4 py-3 text-[9px] font-bold leading-5 dark:border-[#EAE5C9] dark:bg-[#132E3A]">
              {mode === "LOGIN"
                ? "AFTER STABILITY LOCK: REPRODUCE YOUR PRIVATE 10-STEP FINGER MOTION."
                : "AFTER STABILITY LOCK: CREATE A PRIVATE 10-STEP FINGER MOTION. DO NOT USE A HELD POSE."}
            </p>

            {mode === "LOGIN" ? (
              <label className="flex flex-col gap-2 text-[10px] font-bold">
                AGENT IDENTIFICATION
                <input
                  value={agentId}
                  onChange={(event) =>
                    setAgentId(event.target.value.toUpperCase())
                  }
                  placeholder="ENTER AGENT ID"
                  autoComplete="username"
                  spellCheck={false}
                  className="border-4 border-black bg-white px-3 py-3 text-sm font-bold tracking-[0.2em] text-black outline-none placeholder:text-black/40 focus:bg-black focus:text-white dark:border-[#EAE5C9] dark:bg-[#132E3A] dark:text-[#EAE5C9] dark:placeholder:text-[#EAE5C9]/50 dark:focus:bg-[#EAE5C9] dark:focus:text-[#06141B]"
                />
              </label>
            ) : (
              <label className="flex flex-col gap-2 text-[10px] font-bold">
                PROVISIONING TOKEN
                <input
                  value={provisionToken}
                  onChange={(event) => setProvisionToken(event.target.value)}
                  placeholder="PASTE SINGLE-USE TOKEN"
                  autoComplete="off"
                  spellCheck={false}
                  className="border-4 border-black bg-white px-3 py-3 text-xs font-bold normal-case tracking-[0.08em] text-black outline-none placeholder:uppercase placeholder:text-black/40 focus:bg-black focus:text-white dark:border-[#EAE5C9] dark:bg-[#132E3A] dark:text-[#EAE5C9] dark:placeholder:text-[#EAE5C9]/50 dark:focus:bg-[#EAE5C9] dark:focus:text-[#06141B]"
                />
              </label>
            )}

            <div className="flex items-center justify-between border-4 border-black px-4 py-3 text-[11px] font-bold text-black dark:border-[#EAE5C9] dark:text-[#EAE5C9]">
              <span className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                LEVEL RED / CLASSIFIED
              </span>
              <span className="tracking-[0.3em]">◈◈◈◈◈</span>
            </div>

            <button
              type="button"
              onClick={initializeScan}
              className={`group flex items-center justify-center gap-3 px-5 py-4 text-sm font-bold tracking-[0.2em] ${physicalButton}`}
            >
              <ScanLine className="h-4 w-4" />
              {mode === "LOGIN" ? "INITIALIZE SENSOR UPLINK" : "CAPTURE NEW BASELINE"}
            </button>

            <div className="flex flex-col gap-2 border-t-4 border-dashed border-black pt-4 dark:border-[#EAE5C9]">
              <span className="text-[9px] font-bold text-black/60 dark:text-[#EAE5C9]/70">
                // DEV: FORCE STATE
              </span>
              <div className="flex flex-wrap gap-2">
                {states.map((state) => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => setAuthState(state)}
                    className={`border-2 px-2.5 py-1.5 text-[9px] font-bold tracking-[0.15em] transition-colors ${
                      authState === state
                        ? "border-black bg-black text-white dark:border-[#EAE5C9] dark:bg-[#EAE5C9] dark:text-[#06141B]"
                        : "border-black bg-white text-black hover:bg-black hover:text-white dark:border-[#EAE5C9] dark:bg-[#132E3A] dark:text-[#EAE5C9] dark:hover:bg-[#EAE5C9] dark:hover:text-[#06141B]"
                    }`}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-6">
            <div
              className={`relative aspect-square w-full overflow-hidden p-1 ${panel}`}
            >
              <div className="relative h-full w-full bg-white dark:bg-[#06141B]">
                <Webcam
                  key={webcamAttempt}
                  ref={webcamRef}
                  audio={false}
                  playsInline
                  onUserMedia={handleWebcamReady}
                  onUserMediaError={handleWebcamError}
                  videoConstraints={{
                    facingMode: "user",
                    width: 640,
                    height: 640,
                  }}
                  className="absolute inset-0 h-full w-full object-fill grayscale opacity-40"
                />
                <canvas
                  ref={canvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  aria-hidden="true"
                />
                {[
                  "left-3 top-3",
                  "right-3 top-3",
                  "left-3 bottom-3",
                  "right-3 bottom-3",
                ].map((position, index) => (
                  <span
                    key={position}
                    className={`absolute h-6 w-6 border-black dark:border-[#EAE5C9] ${position} ${
                      index < 2 ? "border-t-4" : "border-b-4"
                    } ${index % 2 === 0 ? "border-l-4" : "border-r-4"}`}
                  />
                ))}
                <div
                  className="absolute inset-x-0 bottom-4 flex items-center justify-center px-4 text-center text-[10px] font-bold text-black dark:text-[#EAE5C9]"
                  aria-live="polite"
                >
                  {displayStatus}
                </div>
                {cameraError ? (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-white/95 p-8 text-center text-black dark:bg-[#06141B]/95 dark:text-[#EAE5C9]">
                    <ShieldAlert className="h-12 w-12" strokeWidth={3} />
                    <p className="max-w-sm text-xs font-bold leading-6 tracking-[0.18em]">
                      {cameraError}
                    </p>
                    <button
                      type="button"
                      onClick={retryCamera}
                      className={`px-4 py-3 text-[10px] font-bold tracking-[0.18em] ${physicalButton}`}
                    >
                      [ RETRY CAMERA ]
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={`flex flex-col gap-3 p-5 ${panel}`}>
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span>STABILITY LOCK</span>
                <span className="text-black dark:text-[#EAE5C9]">
                  {Math.round(stabilityProgress)}%
                </span>
              </div>
              {mode === "ENROLL" ? (
                <div className="flex items-center justify-between border-y-2 border-dashed border-black py-2 text-[9px] font-bold dark:border-[#EAE5C9]">
                  <span>BASELINE SAMPLES</span>
                  <span>
                    {enrollmentSampleCount}/{enrollmentSampleTarget}
                  </span>
                </div>
              ) : null}
              <div
                className="h-5 w-full border-4 border-black bg-white dark:border-[#EAE5C9] dark:bg-[#06141B]"
                role="progressbar"
                aria-label="Stability lock"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(stabilityProgress)}
              >
                <div
                  className="h-full bg-black transition-[width] duration-100 ease-out dark:bg-[#EAE5C9]"
                  style={{ width: `${stabilityProgress}%` }}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {flashTone ? (
          <motion.div
            key={`flash-${flashTone}`}
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            onAnimationComplete={() => setFlashTone(null)}
            className="pointer-events-none fixed inset-0 z-[70] bg-black dark:bg-[#EAE5C9]"
            aria-hidden="true"
          />
        ) : null}

        {authState === "VERIFYING" ? (
          <motion.div
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#F4F4F0]/95 text-black backdrop-blur-sm dark:bg-[#06141B]/95 dark:text-[#EAE5C9]"
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="border-4 border-current bg-white p-5 shadow-[8px_8px_0_currentColor] dark:bg-[#132E3A]"
            >
              <Fingerprint className="h-24 w-24" />
            </motion.div>
            <motion.p
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="font-mono text-sm font-bold uppercase tracking-[0.4em]"
            >
              {mode === "LOGIN"
                ? "VERIFYING BIOMETRIC SIGNATURE…"
                : "SEALING BIOMETRIC BASELINE…"}
            </motion.p>
          </motion.div>
        ) : null}

        {authState === "SUCCESS" ? (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black text-white dark:bg-[#EAE5C9] dark:text-[#06141B]"
          >
            <motion.div
              initial={{ scale: 0.4, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="border-4 border-current p-4 shadow-[8px_8px_0_currentColor]"
            >
              <Check className="h-16 w-16" strokeWidth={3} />
            </motion.div>
            <p className="font-mono text-3xl font-bold uppercase tracking-[0.3em]">
              {mode === "LOGIN" ? "ACCESS GRANTED" : "BASELINE ENROLLED"}
            </p>
            {mode === "ENROLL" ? (
              <button
                type="button"
                onClick={handleEnrollmentComplete}
                className="mt-4 border-4 border-white bg-black px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.25em] text-white shadow-[6px_6px_0_white] hover:bg-white hover:text-black dark:border-[#06141B] dark:bg-[#EAE5C9] dark:text-[#06141B] dark:shadow-[6px_6px_0_#06141B] dark:hover:bg-[#06141B] dark:hover:text-[#EAE5C9]"
              >
                [ PROCEED TO LOGIN ]
              </button>
            ) : null}
          </motion.div>
        ) : null}

        {authState === "DENIED" ? (
          <motion.div
            key="denied"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: [0, -14, 14, -8, 8, 0] }}
            exit={{ opacity: 0 }}
            transition={{ x: { duration: 0.5 } }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#F4F4F0] text-black dark:bg-[#06141B] dark:text-[#EAE5C9]"
          >
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.7, repeat: Infinity }}
              className="border-4 border-current bg-white p-4 shadow-[8px_8px_0_currentColor] dark:bg-[#132E3A]"
            >
              <ShieldAlert className="h-16 w-16" strokeWidth={3} />
            </motion.div>
            <p className="font-mono text-3xl font-bold uppercase tracking-[0.3em]">
              {mode === "LOGIN" ? "ANOMALY DETECTED" : "ENROLLMENT REJECTED"}
            </p>
            <p className="max-w-xl px-6 text-center font-mono text-xs font-bold uppercase tracking-[0.2em] opacity-80">
              {authError || "CLEARANCE REVOKED // INCIDENT LOGGED"}
            </p>
            <button
              type="button"
              onClick={initializeScan}
              className={`mt-4 px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.25em] ${physicalButton}`}
            >
              [ RETRY SCAN ]
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
