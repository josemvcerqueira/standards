import { readFile } from "node:fs/promises";

/** The current time in milliseconds. */
export function now(): number {
  return Date.now();
}

/** Reads a file through the platform layer. */
export async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}
