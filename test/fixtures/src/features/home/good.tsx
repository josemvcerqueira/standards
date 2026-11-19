import { ink } from "@/ui/tokens/colors";
import { useTick } from "@/hooks/use-tick";

export function Good() {
  useTick();
  return <div style={{ color: ink }} />;
}
