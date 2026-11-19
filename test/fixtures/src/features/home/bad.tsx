import { useEffect } from "react";
import { send } from "@/features/chat/send";
export function Home() {
  useEffect(() => {}, []);
  requestAnimationFrame(() => send());
  return <div style={{ color: "#fff", padding: 12 }} />;
}
