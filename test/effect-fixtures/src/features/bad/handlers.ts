import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
export class Inside extends Context.Service<Inside, {}>()("svc/features/bad/Inside") {
  static readonly layer = Layer.succeed(Inside, {});
}
