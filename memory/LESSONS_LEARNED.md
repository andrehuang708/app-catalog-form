# LESSONS_LEARNED.md — Jebakan & Pola (tambah tiap ada temuan)

1. **Login API pakai `identifier`/`password` → `sessionToken`** — bukan `email`/`token`. Script E2E yang salah nama field terlihat seperti bug server padahal salah panggil (`src/server/auth.ts`, `http.ts`).
2. **Stage 2 vs total**: `saveWorkerNodes` tolak jika `nodes.length !== total_worker_nodes`. Setiap ubah `totalWorkerNodes`, wizard HARUS antar user ke stage 2 dulu (`initialStageFor` + `canVisit`), bukan langsung stage 3.
3. **Jangan hapus node yang dipakai service** — `saveWorkerNodes` prune selector yang hilang tapi `reject` jika ada service jadi 0 node. UI stage 2 harus ingatkan sebelum hapus hostname yang dirujuk.
4. **Stage 3 rewrite penuh** — `saveServices` DELETE+INSERT per app dalam transaksi; `nodeEdits` frontend harus di-reset setelah save sukses, dan selector ke hostname yang sudah tidak ada harus di-filter (`knownNode`) agar tidak gagal validasi `nodeHostnames`.
5. **Join graph scoped per-app** — `buildVisualGraphRows` key `(applicationId, hostname)`; hostname sama beda app TIDAK tertaut (ada test khusus). Jangan "sederhanakan" jadi key hostname saja.
6. **Vite proxy `/api` same-origin** — dev `bun run dev` (:5173) proxy ke `:8080`; jangan tambah CORS atau baseURL absolut di `useAuthedAction`.
7. **Numerik form = string** — `port`/`totalWorkerNodes` di RCT tetap string; konversi hanya di batas mutasi (`Number(...)`) dan baca balik (`String(...)`). Kebalikannya bikin validasi zod `wholeNumber` gagal.
8. **Whitelist HTTP** — fungsi baru di `src/server/*` tidak bisa dipanggil sebelum masuk `endpoints` di `src/server/http.ts` + `src/api/index.ts`; lupa satu dari dua = 404 misterius.
9. **CSS graph di `@layer components`** (`src/index.css`) — class `graph-*` custom; hapus/duplikat layer bikin graph tak ber-style tapi tanpa error JS. Cek visual, bukan cuma console.
10. **Seed idempoten, bukan reset** — `bun run seed` skip baris `seed-…` yang ada dan tidak overwrite password; untuk ulang dari nol pakai `bun run seed:reset`.
