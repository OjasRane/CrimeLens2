/** A full document navigation discards account-bound clients and in-memory data. */
export function navigateAccountBoundary(path: string) {
  window.location.assign(new URL(path, window.location.origin).toString());
}
