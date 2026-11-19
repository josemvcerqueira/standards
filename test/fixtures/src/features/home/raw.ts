import { Pool } from "pg";
import { readFile } from "node:fs";
import { now } from "@/platform/clock";
export const load = () => fetch("https://example.com");
export const at = () => Date.now() + now();
export const later = () => setTimeout(load, 10);
export const pool = () => new Pool({ readFile });
