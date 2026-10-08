/**
 * Where the signed-in browser keeps its bearer token.
 *
 * The token is minted by `signIn` in src/convex/auth.ts and resolved against
 * the `sessions` table on every request; localStorage is only a cache so a
 * page reload stays signed in. Nothing else about the account lives here.
 */
const STORAGE_KEY = "kube-onboarding.session";

/** Never throws: private modes and non-browser renderers just read as signed out. */
export function readSessionToken(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeSessionToken(token: string | null): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (token === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage unavailable — the next reload simply signs the user out again.
  }
}
