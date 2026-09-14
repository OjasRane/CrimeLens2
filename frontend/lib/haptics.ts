export type HapticType = "light" | "heavy";

export function triggerHaptic(type: HapticType) {
  if (typeof window === "undefined" || !navigator.vibrate) {
    return;
  }

  navigator.vibrate(type === "light" ? 10 : [20, 50, 20]);
}
