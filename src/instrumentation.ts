// Next.js runs register() once when the server boots. Validating the
// environment here means a misconfigured deploy crashes immediately with a
// clear message, instead of failing on the first request that needs a missing
// variable.
export async function register() {
  // Only the Node.js server runtime has the full environment / needs the DB and
  // storage config; skip on the edge runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");
    validateEnv();
  }
}
