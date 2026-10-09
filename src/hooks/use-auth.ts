import { createContext, useContext } from "react";

/**
 * The signed-in account, as returned by the Postgres `users` table through
 * the actions in src/convex/auth.ts.
 */
export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  createdAt: number;
  /** True for accounts allowed to manage users (see src/convex/auth.ts). */
  isAdmin: boolean;
};

export type AuthContextValue = {
  /** True until the stored token has been checked against `sessions`. */
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True only on an install whose `users` table is still empty. */
  needsSetup: boolean;
  user: AuthUser | null;
  sessionToken: string | null;
  signIn: (identifier: string, password: string) => Promise<AuthUser>;
  bootstrap: (input: {
    userId: string;
    email: string;
    name: string;
    password: string;
  }) => Promise<AuthUser>;
  signOut: () => Promise<void>;
};

/**
 * A deliberately signed-out default so `useAuth` is safe to call anywhere —
 * including server-rendered tests that never mount the provider. Anything
 * that needs real credentials renders inside `AuthProvider` instead
 * (src/components/AuthProvider.tsx), which owns the Convex action calls.
 */
const SIGNED_OUT: AuthContextValue = {
  isLoading: true,
  isAuthenticated: false,
  needsSetup: false,
  user: null,
  sessionToken: null,
  signIn: () => Promise.reject(new Error("AuthProvider is not mounted.")),
  bootstrap: () => Promise.reject(new Error("AuthProvider is not mounted.")),
  signOut: () => Promise.resolve(),
};

export const AuthContext = createContext<AuthContextValue>(SIGNED_OUT);

/**
 * The project's authentication: no Convex Auth, no email codes, no guest
 * accounts — an account is a row in Postgres and a session is a row keyed by
 * a hashed bearer token.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
