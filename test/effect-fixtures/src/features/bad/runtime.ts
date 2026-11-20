import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
export const port = Config.Port("PORT");
export const logged = Effect.logInfo(`price ${port}`);
export const now = Date.now();
export const later = setTimeout(() => 1, 5);
console.log("hi");
