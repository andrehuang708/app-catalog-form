import { api } from "@/api";
import {
  AuthContext,
  type AuthContextValue,
  type AuthUser,
} from "@/hooks/use-auth";
import { readSessionToken, writeSessionToken } from "@/lib/session";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Holds the signed-in account in React state and talks to the auth API
 * (src/server/auth.ts over HTTP). The bearer token round-trips through
 * localStorage so a reload can restore the session without a form fill.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    readSessionToken(),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  // With no stored token there is nothing to wait for: we already know the
  // answer is "signed out", so the first paint is not a spinner.
  const [isLoading, setIsLoading] = useState(sessionToken !== null);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Restore the session on mount: ask whether an account exists yet, and if a
  // token was kept, whether it still maps to a live row in `sessions`.
  useEffect(() => {
    let cancelled = false;

    api.auth.setupState()
      .then((state) => {
        if (!cancelled) setNeedsSetup(state.needsSetup);
      })
      .catch(() => {
        // If the install cannot be reached the sign-in form still works; a
        // failed probe just means the setup form is not offered up front.
      });

    const token = readSessionToken();
    if (!token) return;

    api.auth.currentUser()
      .then((found) => {
        if (cancelled) return;
        if (found) {
          setUser(found);
          setSessionToken(token);
        } else {
          // The token is stale or revoked — drop it rather than bounce loops.
          writeSessionToken(null);
          setSessionToken(null);
        }
        setIsLoading(false);
      })
      .catch(() => {
        // A transient failure must not lock the user out of the form.
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const result = await api.auth.signIn({ identifier, password });
      writeSessionToken(result.sessionToken);
      setSessionToken(result.sessionToken);
      setUser(result.user);
      setNeedsSetup(false);
      setIsLoading(false);
      return result.user;
    },
    [],
  );

  const bootstrap = useCallback(
    async (input: {
      userId: string;
      email: string;
      name: string;
      password: string;
    }) => {
      const result = await api.auth.bootstrap(input);
      writeSessionToken(result.sessionToken);
      setSessionToken(result.sessionToken);
      setUser(result.user);
      setNeedsSetup(false);
      setIsLoading(false);
      return result.user;
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      if (readSessionToken()) await api.auth.signOut();
    } catch {
      // Clearing locally is what signs the user out of this browser; the
      // server-side delete is best effort and must not leave them stuck.
    }
    writeSessionToken(null);
    setSessionToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: user !== null,
      needsSetup,
      user,
      sessionToken,
      signIn,
      bootstrap,
      signOut,
    }),
    [isLoading, needsSetup, user, sessionToken, signIn, bootstrap, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
