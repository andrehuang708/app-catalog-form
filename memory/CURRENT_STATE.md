# CURRENT_STATE.md — Status Terkini (update setiap selesai kerja)

> Terakhir diverifikasi: 2026-10-30 — HEAD `618a43c` (+ `origin/main` sinkron), working tree bersih kecuali `.cloud-attachments/` (untracked, abaikan).

## Yang sudah selesai
- [x] Migrasi Convex → Postgres + auth scrypt/session (`54d96ba`, `8dcba18`).
- [x] Wizard onboarding 3-stage + status 4-state + edit rules (total boleh diubah, nama/tenant locked) — `72d4b82`.
- [x] Editor node-selector per service di stage 3 (saved + draft) — `72d4b82`.
- [x] Visual Graph berkelompok Tenant→Namespace→Application→Service→Worker + filter + statistik — `618a43c` (route `/visual-graph`, nav `AdminLayout`, style `src/index.css`, lib, page, test).
- [x] Admin Panel (dashboard + tabel paginasi), Users admin (revoke/restore), Docker air-gapped (`800e009`).
- [x] Seed idempoten 4 aplikasi × 4 status (`scripts/seed.ts` + `tests/seed.test.ts`).

## Verifikasi terakhir yang diketahui
- `bun test` 64 pass, `tsc -b` exit 0, `eslint` 0 error (hanya warning pre-existing), `bun run build` sukses — pada rangkaian `72d4b82` + E2E API + browser `http://localhost:8080` (edit total 3→5, re-point selector, console bersih).
- Setelah `618a43c` (visual graph) belum ada catatan re-run gates di thread ini — **jalankan `bun test` + `bun run build` sebelum kerja berikutnya yang menyentuh graph/onboarding**.

## File kunci + test
- Wizard: `src/components/onboarding/OnboardingWizard.tsx`, `StageTwoForm.tsx`, `StageThreeForm.tsx`, `types.ts`, `src/pages/ApplicationsPage.tsx`, `src/server/onboarding.ts`.
- Graph: `src/lib/visual-graph.ts`, `src/pages/VisualGraphPage.tsx`, `src/components/admin/AdminLayout.tsx`, `src/main.tsx`, `src/index.css`, `tests/visual-graph.test.ts`.
- Schema: `src/lib/onboarding-schema.ts`. Server: `src/server/http.ts`, `pg.ts`, `auth.ts`.

## Tidak ada pekerjaan setengah jalan
Tidak ada branch lain, tidak ada perubahan unstaged yang tertunda (hanya `.cloud-attachments/` dari chat export). Visual Graph yang dulu "WIP" sudah di-commit di `618a43c` — jangan menahan push karena itu lagi.
