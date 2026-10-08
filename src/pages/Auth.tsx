import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { ArrowRight, Loader2, UserPlus } from "lucide-react";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ConvexError } from "convex/values";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

/**
 * Surfaces the sentence the server actually meant to say. Sign-in failures
 * arrive as a ConvexError carrying the message verbatim; anything else is
 * replaced by a fallback rather than leaking an internal error to the form.
 */
function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ConvexError && typeof error.data === "string")
    return error.data;
  if (
    error instanceof Error &&
    error.message &&
    error.message !== "Server Error"
  )
    return error.message;
  return fallback;
}

function Field({
  label,
  ...input
}: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={input.name}>{label}</Label>
      <Input {...input} />
    </div>
  );
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const {
    isLoading: authLoading,
    isAuthenticated,
    needsSetup,
    signIn,
    bootstrap,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  // Derived, not stored: the setup form takes over the moment the server
  // reports that the `users` table is empty, and there is nothing to sign in
  // to until then.
  const mode = needsSetup ? "setup" : "signIn";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      await signIn(
        String(form.get("identifier") ?? ""),
        String(form.get("password") ?? ""),
      );
      navigate(redirect);
    } catch (cause) {
      setError(
        messageOf(cause, "Sign-in failed. Check your details and try again."),
      );
      setIsLoading(false);
    }
  };

  const handleSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      await bootstrap({
        userId: String(form.get("userId") ?? ""),
        email: String(form.get("email") ?? ""),
        name: String(form.get("name") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      navigate(redirect);
    } catch (cause) {
      setError(
        messageOf(cause, "Could not create the first account. Try again."),
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Auth Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center justify-center h-full flex-col">
          <Card className="min-w-[350px] pb-0 border shadow-md">
            {mode === "signIn" ? (
              <>
                <CardHeader className="text-center">
                  <div className="flex justify-center">
                    <img
                      src={logo}
                      alt="Lock Icon"
                      width={64}
                      height={64}
                      className="rounded-lg mb-4 mt-4 cursor-pointer"
                      onClick={() => navigate("/")}
                    />
                  </div>
                  <CardTitle className="text-xl">Sign in</CardTitle>
                  <CardDescription>
                    Use your team email or user ID to open the onboarding form
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleSignIn}>
                  <CardContent className="flex flex-col gap-4">
                    <Field
                      label="Email or user ID"
                      name="identifier"
                      placeholder="name@example.com"
                      autoComplete="username"
                      disabled={isLoading}
                      required
                    />
                    <Field
                      label="Password"
                      name="password"
                      type="password"
                      placeholder="Your password"
                      autoComplete="current-password"
                      disabled={isLoading}
                      required
                    />
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in…
                        </>
                      ) : (
                        <>
                          Sign in
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="text-center">
                  <div className="flex justify-center">
                    <img
                      src={logo}
                      alt="Lock Icon"
                      width={64}
                      height={64}
                      className="rounded-lg mb-4 mt-4 cursor-pointer"
                      onClick={() => navigate("/")}
                    />
                  </div>
                  <CardTitle className="text-xl">
                    Create the first account
                  </CardTitle>
                  <CardDescription>
                    Nobody has an account here yet — set up the one the team
                    signs in with.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleSetup}>
                  <CardContent className="flex flex-col gap-4">
                    <Field
                      label="User ID"
                      name="userId"
                      placeholder="platform.admin"
                      autoComplete="username"
                      disabled={isLoading}
                      required
                    />
                    <Field
                      label="Name"
                      name="name"
                      placeholder="Ada Lovelace"
                      autoComplete="name"
                      disabled={isLoading}
                      required
                    />
                    <Field
                      label="Email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      autoComplete="email"
                      disabled={isLoading}
                      required
                    />
                    <Field
                      label="Password"
                      name="password"
                      type="password"
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      minLength={8}
                      disabled={isLoading}
                      required
                    />
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating…
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Create account
                        </>
                      )}
                    </Button>
                  </CardContent>
                </form>
              </>
            )}

            <div className="py-4 px-6 text-xs text-center text-muted-foreground bg-muted border-t rounded-b-lg">
              Secured by{" "}
              <a
                href="https://freebuff.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary transition-colors"
              >
                freebuff.com
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
