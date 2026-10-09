/**
 * A failure the browser is allowed to read verbatim.
 *
 * Every message thrown as ApiError reaches the UI unchanged (the client
 * fetch wrapper copies `error` from the JSON body), so only write sentences
 * a user could act on. Anything else — SQL failures, programmer errors —
 * is logged server-side and answered with a generic 500 instead.
 *
 * This replaces the ConvexError type the project used while its backend
 * ran on Convex: same contract (message reaches the form), new transport
 * (HTTP status + JSON body).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Shorthand used across the handlers: `reject("…")` never returns. */
export function reject(message: string, status = 400): never {
  throw new ApiError(message, status);
}
