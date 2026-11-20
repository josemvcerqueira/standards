import * as Context from "effect/Context";
import * as Schema from "effect/Schema";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
export class SecondApi extends HttpApi.make("second") {}
export class StrayGroup extends HttpApiGroup.make("stray") {}
export class StrayError extends Schema.TaggedError<StrayError>()("StrayError", {}) {}
export const strayHandlers = HttpApiBuilder.group(SecondApi, "stray", () => undefined);
export class NoLayer extends Context.Service<NoLayer, {}>()("svc/features/bad/NoLayer") {}
