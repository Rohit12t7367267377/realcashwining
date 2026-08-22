// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

/**
 * A client that disconnects mid-request (navigation, refresh, cancelled fetch)
 * makes Node emit `Error: aborted` from `abortIncoming`. It is not an app bug,
 * so it must never be recorded or surfaced as a runtime error.
 */
export function isBenignAbortError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? "";
  const message = (error as { message?: string } | null)?.message ?? "";
  const code = (error as { code?: string } | null)?.code ?? "";
  return (
    name === "AbortError" ||
    code === "ECONNRESET" ||
    code === "ERR_STREAM_PREMATURE_CLOSE" ||
    /^aborted$/i.test(message.trim()) ||
    /aborted|socket hang up|premature close|request aborted/i.test(message)
  );
}

function record(error: unknown) {
  if (isBenignAbortError(error)) return;
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

// Node dev server: client disconnects surface as a process-level `Error: aborted`
// from abortIncoming(), which never reaches the addEventListener hooks above.
// Swallow those so they don't crash the request or show a blank error page.
const proc = (globalThis as { process?: NodeJS.Process }).process;
if (proc && typeof proc.on === "function" && !(proc as unknown as { __lovableAbortGuard?: boolean }).__lovableAbortGuard) {
  (proc as unknown as { __lovableAbortGuard?: boolean }).__lovableAbortGuard = true;
  proc.on("uncaughtException", (error: unknown) => {
    if (isBenignAbortError(error)) return;
    record(error);
    console.error(error);
  });
  proc.on("unhandledRejection", (reason: unknown) => {
    if (isBenignAbortError(reason)) return;
    record(reason);
  });
}


export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
