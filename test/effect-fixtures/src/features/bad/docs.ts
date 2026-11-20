import * as HttpApiScalar from "effect/http-api/HttpApiScalar";
import * as HttpApiSwagger from "effect/http-api/HttpApiSwagger";
import { Api } from "@/data/api/Api";
export const embedded = HttpApiScalar.layer(Api);
export const unpinned = HttpApiScalar.layerCdn(Api, { path: "/docs" });
export const latest = HttpApiScalar.layerCdn(Api, { version: "latest" });
export const swagger = HttpApiSwagger.layer;
