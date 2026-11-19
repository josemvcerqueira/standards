import { formatCents } from "@/lib/cents";

export type Health = { status: "ok"; uptimeSeconds: number; sample: string };

/** The health payload served at GET /health. */
export function readHealth(uptimeSeconds: number): Health {
  return { status: "ok", uptimeSeconds, sample: formatCents(100) };
}
