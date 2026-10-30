# HANDOFF.md — Lanjut Kerja (untuk sesi / agen berikutnya)

## Cara mulai sesi baru (Freebuff atau Codex)
1. Baca `AGENTS.md` + `memory/PROJECT_CONTEXT.md` + `memory/CURRENT_STATE.md`.
2. `git log --oneline -5 --decorate && git status --short --branch`.
3. `bun install` (jika fresh) lalu `bun test` cepat untuk file yang akan disentuh.

## Cara_verifikasi standar
```bash
bun test                  # semua test (bun:test)
bun run build             # tsc -b && vite build — wajib hijau sebelum push
npx eslint <file...>      # setidaknya pada file tersentuh
docker compose up -d && curl -s localhost:8080/api/health  # jika ubah server/DB
bun run seed              # isi demo (admin@example.com / Password123!)
```

## Arahan terbuka (belum dikerjakan — pilih sesuai permintaan user)
- [ ] Pagination/filters tambahan di Visual Graph saat data besar (saat ini render semua grup; pertimbangkan virtualisasi atau collapse per grup).
- [ ] E2E `decrease total` (turunkan budget lalu hapus surplus rows) — server sudah izinkan, tapi alur UI hapus-baris-belum-ada; putuskan UX-nya.
- [ ] Audit `services.page-copy` / coverage `stages-render` bila wizard berubah lagi.
- [ ] UX empty-state Visual Graph per-tenant kosong (saat ini global/filtered saja).

## Batasan yang diketahui
- `bun run start` butuh `DATABASE_URL`; tanpa itu hanya `bun run dev` (frontend) yang jalan.
- Seed tidak overwrite akun existing — jika lupa password lokal, buat via `/auth` bootstrap saat `users` kosong atau update langsung di DB.
- Jangan tambah file/commit yang tidak diminta; push hanya ke branch yang diminta user.

## Setelah selesai kerja
Update `CURRENT_STATE.md` (apa berubah + hasil gates), `HANDOFF.md` (sisa kerja), `DECISIONS.md` (jika ada keputusan baru), `LESSONS_LEARNED.md` (jika ada jebakan baru). Jaga ringkas.
