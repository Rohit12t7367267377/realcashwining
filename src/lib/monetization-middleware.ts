import { createMiddleware } from "@tanstack/react-start";
import { BLOCK_EVENT, parseBlock } from "@/lib/monetization";

/**
 * Client-side: when any server function is refused because credits or limits ran out, tell the UpgradePrompt.
 * The error is re-thrown unchanged so every screen keeps its own error handling.
 */
export const watchMonetizationBlocks = createMiddleware({ type: "function" }).client(async ({ next }) => {
  try {
    return await next();
  } catch (e) {
    const info = parseBlock(e);
    if (info && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(BLOCK_EVENT, { detail: info }));
    throw e;
  }
});
