/** Where the API is running decides where shared state can live. */
/**
 * Vercel sets VERCEL=1 in every build and every function invocation.
 * CHANNEL_STORE=db forces it on elsewhere; CHANNEL_STORE=memory forces it off,
 * which is the escape hatch if this is ever wrong.
 */
export function isServerlessRuntime(): boolean {
  const forced = process.env.CHANNEL_STORE;
  if (forced === "db") return true;
  if (forced === "memory") return false;
  return !!process.env.VERCEL;
}
