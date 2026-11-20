import * as Schema from "effect/Schema";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
export const loose = HttpApiEndpoint.get("loose", "/loose", { success: Schema.Unknown });
export const builder = HttpApiBuilder.group;
export class Inline extends Schema.Class<Inline>("Inline")({ id: Schema.String }) {}
