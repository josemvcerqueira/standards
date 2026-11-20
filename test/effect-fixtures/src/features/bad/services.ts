import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as BunRuntime from "@/platform/runtime";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
export class OldTag extends Context.Tag("OldTag")<OldTag, {}>() {}
export class OldService extends Effect.Service<OldService>()("OldService", {}) {}
export class NoPath extends Context.Service<NoPath, {}>()("NoPath") {}
export const ran = Effect.runPromise(Effect.void);
export const provided = Effect.void.pipe(Effect.provide([]));
export const promised = Effect.promise(() => Promise.resolve(1));
export const tried = Effect.tryPromise(() => Promise.resolve(1));
export async function legacy() {
  return 1;
}
export const main = BunRuntime.runMain(Effect.void);
export const runtime = ManagedRuntime.make(Layer.empty);
