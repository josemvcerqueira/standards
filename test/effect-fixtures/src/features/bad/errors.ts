import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
export class Missing extends Schema.TaggedError<Missing>()("Missing", {}) {}
export const noReturn = Effect.fn("noReturn")(function* () {
  yield* new Missing();
});
export const throws = Effect.fn("throws")(function* () {
  throw new Missing();
});
export class Old extends Data.TaggedError("Old")<{}> {}
export const bare = Effect.fail(new Error("boom"));
export class Plain extends Error {}
export const v3 = Effect.succeed(1).pipe(Effect.catchAll(() => Effect.succeed(2)));
export const fork = Effect.fork(Effect.void);
