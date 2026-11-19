import { Button } from "@/ui/button";
import { chat } from "../features/chat/chat";
export const total = (a: any) => a! + process.env.FEE;
// stale comment
export const wait = () => new Promise((r) => setTimeout(r, 500));
