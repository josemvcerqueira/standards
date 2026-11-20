import { Database } from "bun:sqlite";

export const db = new Database(":memory:");
export const file = Bun.file("x.txt");
export const wait = (): Promise<void> => Bun.sleep(10);
