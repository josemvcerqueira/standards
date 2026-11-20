import { Database } from "bun:sqlite";

export const db = new Database(":memory:");
export const serve = (port: number): ReturnType<typeof Bun.serve> =>
  Bun.serve({ port, fetch: () => new Response("ok") });
