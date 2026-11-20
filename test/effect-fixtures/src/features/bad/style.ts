import * as Effect from "effect/Effect";
export const wrapsGen = (n: number) =>
  Effect.gen(function* () {
    return n;
  });
export const wrapsGenPipe = (n: number) =>
  Effect.gen(function* () {
    return n;
  }).pipe(Effect.orDie);
export function returnsGen(n: number) {
  return Effect.gen(function* () {
    return n;
  });
}
export const pipedFn = Effect.fn("pipedFn")(function* () {
  return 1;
}).pipe(Effect.orDie);
export const unnamed = Effect.fn(function* () {
  return 1;
});
export const dropped = Effect.fn("dropped")(function* () {
  Effect.log("never runs");
  return 1;
});
export const unnamedPiped = Effect.fn(function* () {
  return yield* Effect.succeed(1);
}).pipe(Effect.orDie);
