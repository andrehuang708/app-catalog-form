import { app } from "./http";

/**
 * The app's single runtime process: one Bun server that answers /api/* with
 * the Postgres-backed handlers and everything else with the built Vite
 * bundle (see src/server/http.ts). This is what the Docker image starts —
 * there is no Convex deployment, no separate backend, and no outbound
 * network dependency at runtime.
 */
const port = Number(process.env.PORT ?? 8080);

Bun.serve({ port, fetch: app.fetch });

console.log(`Kube App Onboarding Form listening on http://0.0.0.0:${port}`);
