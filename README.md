## Overview

This project uses the following tech stack:
- Vite
- Typescript
- React Router v7 (all imports from `react-router` instead of `react-router-dom`)
- React 19 (for frontend components)
- Tailwind v4 (for styling)
- Shadcn UI (for UI components library)
- Lucide Icons (for icons)
- Hono + Bun (API server, serves the built Vite bundle too)
- PostgreSQL (the only database: onboarding data + accounts)
- Postgres-backed authentication (scrypt password hashes + session tokens)
- Framer Motion (for animations)
- Three js (for 3d models)

All relevant files live in the 'src' directory.

Use bun for the package manager.

## Setup

The app is one Bun process: it serves the API under `/api/*` and the built
Vite bundle from `dist/` (see `src/server/index.ts`), with Postgres as the
only external dependency — no Convex, no outbound network at runtime, which
makes it directly deployable in an air-gapped Docker environment.

```bash
bun install
bun run build      # tsc -b && vite build → dist/
bun start          # API + static server on :8080
```

For local frontend work run `bun run dev` (Vite on :5173) next to
`bun start` — Vite proxies `/api` to :8080 so the app stays same-origin.

## Environment Variables

The server reads two variables (see `.env.example`):

- `DATABASE_URL` — the Postgres connection string holding both the accounts
  (`users` / `sessions`) and the onboarding data. TLS is decided by the
  `sslmode` parameter on this URL.
- `PORT` — the listen port (default 8080).

## Docker (air-gapped deployment)

The app ships as two separate images — the app image and a stock Postgres
image — wired together by `docker-compose.yml`:

```bash
docker compose up -d
```

- `app` builds from `Dockerfile` (multi-stage: `bun install` + `vite build`,
  then a slim runtime that runs `bun src/server/index.ts`). It waits for the
  database healthcheck, creates its schema idempotently on first start, and
  serves everything on port 8080.
- `db` is the official `postgres:17-alpine` image with its data in a named
  volume — a completely separate container/image, as requested.

For an air-gapped host, build and transfer the images once from a connected
machine:

```bash
docker compose build
docker save kube-onboarding-app | gzip > app.tar.gz   # app image
docker save postgres:17-alpine | gzip > db.tar.gz      # db image
# on the air-gapped host:
gunzip -c app.tar.gz | docker load
gunzip -c db.tar.gz | docker load
docker compose up -d
```

## Seeding demo data

`bun run seed` fills the database with demo content: two accounts
(`admin@example.com` / `Password123!` as Administrator, `demo@example.com` /
`Password123!` as Member), four applications covering every status the
Applications list renders (Complete, Services needed, Worker nodes needed,
Worker nodes out of sync), plus their worker nodes and services.

It is idempotent — rows with `seed-…` ids that already exist are skipped, and
existing accounts are never overwritten (an existing account keeps its old
password; the script prints what actually applies). To wipe only the seed
rows and start fresh:

```bash
bun run seed:reset
```

The fixtures live in `scripts/seed.ts` and are validated against the real
onboarding zod schemas by `tests/seed.test.ts`.


# Using Authentication (Important!)

You must follow these conventions when using authentication.

## Auth is already set up.

Authentication is entirely Postgres-backed — there is no third-party issuer,
no email OTP, and no hosted backend. Accounts are rows in the `users`
table, passwords are stored as scrypt hashes (`src/server/password.ts`), and a
signed-in browser holds a bearer token that maps to one row of `sessions`
(only the token's sha256 is stored).

The whole of sign-in lives in `src/server/auth.ts`: `setupState` (is this an
empty install?), `bootstrap` (create the first, admin account), `signIn`
(user ID **or** email + password), `currentUser`, `signOut`, and the
account-administration handlers (`listUsers`, `createUser`, `revokeUser`,
`restoreUser`). They are exposed over HTTP by the whitelist in
`src/server/http.ts` (`POST /api/<module>/<function>`).

## Using auth on the backend

Every protected handler resolves its caller's `sessionToken` against the
`sessions` table before touching data. Use `sessionUser` from
`src/server/auth.ts`, or copy the `requireSignedIn` helper in
`src/server/onboarding.ts`:

```ts
import { sessionUser } from "./auth";
import { reject } from "./errors";

const user = await sessionUser(args.sessionToken);
if (user === null) reject("Your session has expired. Sign in again to continue.", 401);
```

`sessionUser` returns `null` for unknown, expired, or **revoked** accounts, and
the user carries `isAdmin` for role checks. Account-administration handlers must
gate on it (see `requireAdmin` in `src/server/auth.ts`). Throw `ApiError`
(`src/server/errors.ts`) for any message the UI should show verbatim.

## Using auth on the frontend

The `/auth` page is already set up to use auth. Navigate to `/auth` for all log in / sign up sequences.

You MUST use this hook to get user data. Never do this yourself without the hook:
```typescript
import { useAuth } from "@/hooks/use-auth";

const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
```

For API calls (everything in `src/api`), pages get their functions through
`useAuthedAction` — the fetch client attaches the bearer token from
localStorage, so pages never handle it:

```typescript
import { useAuthedAction } from "@/hooks/use-authed-action";

const listTenants = useAuthedAction(api.onboarding.listTenants);
const rows = await listTenants(); // no sessionToken argument
```

## Protected Routes

The starter `/dashboard` route is protected with `RequireAuth`. Extend that page
for the product's authenticated experience, and reuse `RequireAuth` when adding
another protected route — do NOT hand-roll a redirect to `/auth`, since landing
on a bare sign-in form with no explanation of what was blocked is confusing.

`RequireAuth` states the block on the page the visitor asked for and sends them
to `/auth?returnTo=<current route>` when they choose to sign in, so they come
back to it. Pass `title` and `description` to say what the page is:

```tsx
<Route
  path="/dashboard"
  element={
    <RequireAuth
      title="Sign in to view your dashboard"
      description="Your projects and settings live here."
    >
      <Dashboard />
    </RequireAuth>
  }
/>
```

Pass `redirectImmediately` for a route where bouncing straight to `/auth` really
is better.

## Auth Page

The auth page is defined in `src/pages/Auth.tsx`. Send sign-in and first-run
account-creation actions to `/auth`. It shows the sign-in form normally, and
swaps to the "create the first account" form only while the `users` table is
empty.

## Authorization

You can perform authorization checks on the frontend and backend.

On the frontend, use the `useAuth` hook: `user.isAdmin` gates the Users page
and the sidebar's Users entry (the server rejects non-admins regardless).

On the backend, protect every handler at its base level — resolve the session
first (see "Using auth on the backend"), and check roles before reads or
writes. The account-administration handlers in `src/server/auth.ts` show the
pattern.

## Adding a redirect after auth

The `/auth` route in `src/main.tsx` redirects to `/dashboard` by default. If the
product's main authenticated route is different, update `redirectAfterAuth` to
that route. A validated same-origin `returnTo` query parameter takes priority so
users can resume the protected page they originally requested. Never leave an
authenticated product redirecting back to the public landing page.

## Complete authenticated products

When the requested product implies accounts, a workspace, a dashboard, or other
signed-in functionality, the task is not complete with only a landing page and
auth form. Build the main authenticated experience, protect its route, and verify
that signing in reaches it.

# Frontend Conventions

You will be using the Vite frontend with React 19, Tailwind v4, and Shadcn UI.

Generally, pages should be in the `src/pages` folder, and components should be in the `src/components` folder.

Shadcn primitives are located in the `src/components/ui` folder and should be used by default.

## Page routing

Your page component should go under the `src/pages` folder.

When adding a page, update the react router configuration in `src/main.tsx` to include the new route you just added.

## Shad CN conventions

Follow these conventions when using Shad CN components, which you should use by default.
- Remember to use "cursor-pointer" to make the element clickable
- For title text, use the "tracking-tight font-bold" class to make the text more readable
- Always make apps MOBILE RESPONSIVE. This is important
- AVOID NESTED CARDS. Try and not to nest cards, borders, components, etc. Nested cards add clutter and make the app look messy.
- AVOID SHADOWS. Avoid adding any shadows to components. stick with a thin border without the shadow.
- Avoid skeletons; instead, use the loader2 component to show a spinning loading state when loading data.


## Landing Pages

You must always create good-looking designer-level styles to your application. 
- Make it well animated and fit a certain "theme", ie neo brutalist, retro, neumorphism, glass morphism, etc

Use known images and emojis from online.

If the user is logged in already, show the get started button to say "Dashboard" or "Profile" instead to take them there.

## Responsiveness and formatting

Make sure pages are wrapped in a container to prevent the width stretching out on wide screens. Always make sure they are centered aligned and not off-center.

Always make sure that your designs are mobile responsive. Verify the formatting to ensure it has correct max and min widths as well as mobile responsiveness.

- Always create sidebars for protected dashboard pages and navigate between pages
- Always create navbars for landing pages
- On these bars, the created logo should be clickable and redirect to the index page

## Animating with Framer Motion

You must add animations to components using Framer Motion. It is already installed and configured in the project.

To use it, import the `motion` component from `framer-motion` and use it to wrap the component you want to animate.


### Other Items to animate
- Fade in and Fade Out
- Slide in and Slide Out animations
- Rendering animations
- Button clicks and UI elements

Animate for all components, including on landing page and app pages.

## Three JS Graphics

Your app comes with three js by default. You can use it to create 3D graphics for landing pages, games, etc.


## Colors

You can override colors in: `src/index.css`

This uses the oklch color format for tailwind v4.

Always use these color variable names.

Make sure all ui components are set up to be mobile responsive and compatible with both light and dark mode.

Set theme using `dark` or `light` variables at the parent className.

## Styling and Theming

When changing the theme, always change the underlying theme of the shad cn components app-wide under `src/components/ui` and the colors in the index.css file.

Avoid hardcoding in colors unless necessary for a use case, and properly implement themes through the underlying shad cn ui components.

When styling, ensure buttons and clickable items have pointer-click on them (don't by default).

Always follow a set theme style and ensure it is tuned to the user's liking.

## Toasts

You should always use toasts to display results to the user, such as confirmations, results, errors, etc.

Use the shad cn Sonner component as the toaster. For example:

```
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
export function SonnerDemo() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast("Event has been created", {
          description: "Sunday, December 03, 2023 at 9:00 AM",
          action: {
            label: "Undo",
            onClick: () => console.log("Undo"),
          },
        })
      }
    >
      Show Toast
    </Button>
  )
}
```

Remember to import { toast } from "sonner". Usage: `toast("Event has been created.")`

## Dialogs

Always ensure your larger dialogs have a scroll in its content to ensure that its content fits the screen size. Make sure that the content is not cut off from the screen.

Ideally, instead of using a new page, use a Dialog instead. 

# Using the backend (Hono + Postgres)

There is no Convex anymore. The backend is plain TypeScript functions over
Postgres, exposed through one Hono route.

## The HTTP surface

`src/server/http.ts` maps `POST /api/<module>/<function>` onto an explicit
whitelist of handlers (`auth` and `onboarding` modules). The route:

1. rejects anything not in the whitelist with a 404,
2. parses the JSON body,
3. injects `sessionToken` from the `Authorization: Bearer …` header,
4. returns the handler's value as JSON — or `{ "error": "…" }` with the
   `ApiError` status so the UI can show the sentence verbatim.

Anything not under `/api` is served from `dist/` (the Vite build) with an
SPA fallback to `index.html`.

## Adding a new endpoint

1. Write the handler in `src/server/onboarding.ts` (or a new module):
   a plain `async function` taking one args object, validating with the zod
   schemas in `src/lib/onboarding-schema.ts`, throwing `reject("message")`
   for user-facing failures, and gating with `requireSignedIn` /
   `requireAdmin` before touching data.
2. Add it to the `endpoints` whitelist in `src/server/http.ts`.
3. Expose it in `src/api/index.ts` (type it with `PublicArgs`/`Result` from
   the handler so a signature change breaks the build).
4. Call it from a page via `useAuthedAction(api.<module>.<fn>)`.

## Database

All schema lives in the idempotent DDL in `src/server/pg.ts` — tables are
created on first query, no migration step. `queryRows` runs parameterized
statements; `withTransaction` gives COMMIT/ROLLBACK for multi-statement
saves. Never build SQL by string concatenation — always pass values as
`$1`, `$2`, … parameters.

## Common mistakes to avoid

- Never trust request bodies: re-validate everything with zod on the server,
  even though the forms already validate client-side.
- Never take an account id from the client — always resolve the caller with
  `sessionUser`/`requireAdmin` and scope queries by that id.
- Never return `password_hash` or raw session tokens from a handler.
- Never add a new exported function to `src/server/*` without adding it to
  the whitelist — and never whitelist something the pages should not reach.
- Keep `/api` same-origin: do not add CORS; Vite proxies `/api` in dev and
  the production server serves the UI itself.
