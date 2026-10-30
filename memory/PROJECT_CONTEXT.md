# PROJECT_CONTEXT.md — Konteks Proyek (sumber bersama Freebuff + Codex)

## Apa ini
Kube App Onboarding Form —internal tool platform team untuk mendaftarkan aplikasi (3-stage wizard), mengelola tenant/namespace/service/worker-node, dan memetakan relasi infrastruktur di Visual Graph. Admin Panel = satu shell `AdminLayout` (sidebar + topbar) di sekeliling semua halaman manajemen.

## Arsitektur
- Satu proses Bun: `bun src/server/index.ts` serve `POST /api/<module>/<function>` (Hono, `src/server/http.ts`) + static `dist/` dengan SPA fallback.
- Modul API: `auth` + `onboarding`. Frontend memanggil via `src/api/index.ts` + `useAuthedAction` (token Bearer otomatis).
- DB: PostgreSQL saja. Skema dibuat idempoten di `src/server/pg.ts` (`queryRows`, `withTransaction`). Tabel: `applications`, `worker_nodes`, `services`, `tenants`, `users`, `sessions`.
- Tidak ada Convex, tidak ada CORS, tidak ada outbound network saat runtime.

## Rute (`src/main.tsx`)
Publik: `/auth`. Terproteksi (`RequireAuth` + `AdminLayout`, `redirectImmediately`): `/`, `/dashboard`, `/onboarding`, `/applications`, `/namespaces`, `/services`, `/worker-nodes`, `/visual-graph`, `/tenants`, `/users`. Fallback: `*` → `NotFound`.

## Alur onboarding (inti produk)
- **Stage 1** (`StageOneForm` + `stageOneSchemaFor`): `applicationName` (max 80), `repositoryName` (max 200), `tenant` (harus dari daftar `tenants`), `totalWorkerNodes` (string numerik 1–1000).
- **Stage 2** (`StageTwoForm` + `workerNodesSchema(total)`): tepat `total` baris; tiap baris IPv4 + hostname DNS-subdomain + `joinedCluster`; IP/hostname unik dalam list.
- **Stage 3** (`StageThreeForm` + `servicesSchema`): free-length list; tiap service = namespace `app-tenant-(suffix)` + `serviceName` unik per app + `port` 1–65535 + `healthcheckUrl` http(s) + `nodeSelectors ⊆ stage-2 hostnames (min 1)` + `description` (max 500). Simpan = satu mutasi rewrite seluruh list.
- **Status** (`statusOf` di `src/components/onboarding/types.ts`): `Worker nodes needed` (0 node) → `Worker nodes out of sync` (count ≠ total, menang atas Complete) → `Complete` (node ok + ada service) → `Services needed`.
- **Edit rules**: setelah ada service, `applicationName`+`tenant` locked (tertanam di namespace); `totalWorkerNodes` boleh diubah → wizard kirim user ke stage 2 (baris tersimpan dipertahankan + slot kosong ditambah), stage 3 terkunci sampai node lengkap. `ApplicationsPage` Edit dialog ikut aturan yang sama.

## Visual Graph (`src/lib/visual-graph.ts` + `VisualGraphPage.tsx`)
- Mapping murni: `buildVisualGraphRows(services, nodes)` join selector→node **scoped per application**; `buildVisualGraph(rows)` = DAG 5 lapis Tenant→Namespace→Application→Service→Worker (dedup node, edge langsung); `groupVisualGraphs(rows, grouping)` untuk `all|tenant|namespace|application`.
- Node hilang (selector tanpa node) = kind `missing` (dashed + "Node not found"), tetap ada edge agar terlihat.
- UI: kartu statistik, legenda 5 tahap, filter teks (tenant/namespace/app/service/hostname), tombol grup, canvas SVG bezier + marker panah, empty-state jelas.

## Auth
- `src/server/auth.ts`: `setupState`, `bootstrap` (akun pertama = admin), `signIn` (id ATAU email + password), `currentUser`, `signOut`, `listUsers/createUser/revokeUser/restoreUser` (admin-only via `requireAdmin`).
- Frontend: `useAuth()` (`@/hooks/use-auth`) untuk state user; `user.isAdmin` gate halaman Users + entri sidebar (server tetap enforce).

## Data & seed
- `bun run seed` isi idempoten: admin `admin@example.com` + member `demo@example.com` (password `Password123!`, tidak overwrite akun existing), 4 aplikasi (satu per status), nodes + services. `bun run seed:reset` hapus hanya baris seed. Fixture di `scripts/seed.ts`, divalidasi `tests/seed.test.ts`.

## Deploy
- `docker-compose.yml`: `app` (build `Dockerfile`: `bun install` + `vite build`, serve :8080, tunggu db healthy, DDL idempoten) + `db` (`postgres:17-alpine`, volume `pgdata`). Air-gapped: `docker compose build` lalu `docker save` kedua image.
- `Dockerfile` multi-stage, healthcheck `GET /api/health`.
