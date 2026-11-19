import { createServer } from "node:http";
import { env } from "@/config/env";
import { readHealth } from "@/features/health/health";

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(readHealth(process.uptime())));
    return;
  }
  response.writeHead(404).end();
});

server.listen(env.PORT, () => {
  // oxlint-disable-next-line no-console -- the one startup line; use a logger once the service has one
  console.info(`listening on ${env.PORT}`);
});
