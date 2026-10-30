# AGENTS.md — Shared Project Memory (Freebuff + Codex)

Sumber kebenaran untuk agen AI di repo ini. **Baca file ini + `memory/` sebelum mulai kerja.**

## Stack (jangan diganti tanpa diskusi)

- Frontend: Vite + TypeScript + React 19 + React Router v7 (`react-router`, bukan `react-router-dom`) + Tailwind v4 + shadcn + Lucide + Framer Motion.
- Backend: Hono + Bun, satu proses Bun (`bun src/server/index.ts`) — serve API `/api/*` + bundle Vite dari `dist/` (`src/server/index.ts`).
- Database: **PostgreSQL satu-satunya** (onboarding + accounts). Tidak ada Convex, tidak ada network outbound saat runtime (air-gapped ready).
- Auth: Postgres-backed — password hash scrypt (`src/server/password.ts`), bearer token → sha256 di tabel `sessions` (`src/server/auth.ts`).
- Package manager: **bun** (bukan npm/yarn). Build: `bun run build` (`tsc -b && vite build`).

## Perintah kunci

```bash
bun install
bun run dev        # Vite :5173, proxy /api → :8080
bun start          # API + static :8080 (butuh DATABASE_URL)
bun test           # bun test (semua tests/)
bun run build      # tsc -b && vite build → dist/
bun run lint       # eslint . (opsional: eslint file)
bun run seed       # seed demo; bun run seed:reset untuk wipe seed rows
docker compose up -d  # app (kube-onboarding-app) + db (postgres:17-alpine), port 8080
```

Env: `DATABASE_URL` (connection string Postgres, `sslmode` tentukan TLS), `PORT` (default 8080). Lihat `.env.example`. Jangan commit `.env` / `.env.local`.

## Struktur yang penting

- `src/pages/` — route pages (`Dashboard`, `OnboardingPage`, `ApplicationsPage`, `NamespacesPage`, `ServicesPage`, `WorkerNodesPage`, `VisualGraphPage`, `TenantsPage`, `UsersPage`, `Auth`).
- `src/main.tsx` — router + `RequireAuth` + `AdminLayout` shell. Tambah page = tambah lazy import + `<Route>` di sini.
- `src/components/onboarding/` — wizard 3-stage (`OnboardingWizard`, `StageOneForm`, `StageTwoForm`, `StageThreeForm`, `types.ts`).
- `src/lib/onboarding-schema.ts` — zod schemas + helpers namespace (`buildNamespace`, `namespacePart`, `namespaceSuffixOf`, `namespaceSuggestions`).
- `src/lib/visual-graph.ts` — pure mapping services+nodes → graph Tenant→Namespace→Application→Service→Worker.
- `src/server/` — `http.ts` (whitelist `POST /api/<module>/<function>`), `onboarding.ts` (handlers), `auth.ts`, `pg.ts` (DDL idempoten + `queryRows`/`withTransaction`), `errors.ts` (`reject`/`ApiError`).
- `src/api/index.ts` — client tipes (`PublicArgs`/`Result`) yang mirror handler server.
- `src/hooks/` — `useAuth` (data user), `useAuthedAction` (panggil API, token otomatis dari localStorage).
- `tests/` — `bun:test` (schema, visual-graph, seed, pages-copy, stages-render, password, postgres).

## Aturan backend (wajib)

1. Handler = `async function` satu args object, validasi ulang dengan zod dari `src/lib/onboarding-schema.ts` (form client bukan pertahanan).
2. Selalu resolve caller via `sessionUser` / `requireSignedIn` / `requireAdmin` — **jangan ambil account id dari client**.
3. Jangan return `password_hash` / raw session token.
4. SQL selalu parameterized `$1, $2…` via `queryRows` / `client.query`. Jangan string-concat.
5. Daftarkan endpoint baru di whitelist `src/server/http.ts` + expose di `src/api/index.ts` + panggil via `useAuthedAction`.
6. Jangan tambah CORS — `/api` same-origin (Vite proxy saat dev, server serve UI sendiri saat prod).
7. Error user-facing = `reject("kalimat persis untuk UI")` / `throw new ApiError(...)`.

## Aturan frontend (wajib)

- Pages di `src/pages/`, komponen di `src/components/`, primitif shadcn di `src/components/ui/`.
- Auth frontend hanya via `useAuth()` + `useAuthedAction(api.…)` — jangan pegang token manual.
- Route proteksi bungkus `RequireAuth` dengan `title`+`description` (jangan hand-roll redirect ke `/auth`).
- Form numeric tetap string di form, konversi ke number sebelum mutasi.
- Toast via `sonner`, loading pakai `Loader2` (bukan skeleton), dialog besar harus scrollable, mobile-responsive + light/dark mode, tombol clickable pakai `cursor-pointer`.

## Domain onboarding (jangan rusak)

- Namespace tersimpan = `applicationname-tenant-(freetext)` via `buildNamespace`. Unik per tenant, **boleh dipakai ulang oleh banyak service**. Suffix max 40 char, full namespace max 63 char.
- Stage 1 (app+tenant+total): `applicationName` + `tenant` **terkunci permanen** setelah ada service tersimpan (karena tertanam di namespace). `totalWorkerNodes` **boleh diubah** — membuat status `Worker nodes out of sync` dan membuka ulang stage 2.
- Stage 2: jumlah baris harus `=== totalWorkerNodes`, IP/hostname unik. Simpan boleh memangkas selector service yang hilang, tapi tolak jika ada service jadi tanpa node.
- Stage 3: simpan satu mutasi rewrite seluruh list; tiap baris (saved maupun draft) punya toggle node selector sendiri; tolak save jika ada service tanpa node.
- Status (`statusOf`): `Worker nodes needed` → `Worker nodes out of sync` (menang atas Complete) → `Complete` → `Services needed`.
- Visual Graph: relasi `Tenant → Namespace → Application → Service → Worker node`, join node **per application** (hostname sama beda app tidak tertaut), node hilang tampil sebagai `missing` (dashed), grouping `all|tenant|namespace|application`.

## Cara kerja dengan Shared Memory

1. Sebelum ubah kode: baca `AGENTS.md` + `memory/PROJECT_CONTEXT.md` + `memory/CURRENT_STATE.md`. Jika menyentuh keputusan lama, cek `memory/DECISIONS.md`.
2. Setelah selesai (atau gagal): update `memory/CURRENT_STATE.md` + `memory/HANDOFF.md`. Keputusan baru → catat di `memory/DECISIONS.md`. Pelajaran → `memory/LESSONS_LEARNED.md`.
3. Jaga file memory tetap ringkas dan faktual (path file + perilaku, bukan esai).

## Verifikasi sebelum klaim selesai

- `bun test`, `tsc -b` (via `bun run build`), `eslint` pada file tersentuh, dan `bun run build` sukses. Untuk perubahan server/DB: uji alur via `docker compose` (`/api/health` + login + alur stage yang diubah). Laporkan yang gagal/tidak bisa jalan sebagai limitasi — jangan skip test atau tambah suppress agar hijau.
