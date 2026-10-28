import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";

import { apiErrorHandler, apiRequestLogger } from "../apiRequestLogging";

type CapturedLogs = { info: string[]; error: string[] };

const captureLogs = (): { logs: CapturedLogs; restore: () => void } => {
  const logs: CapturedLogs = { info: [], error: [] };
  const originalInfo = console.info;
  const originalError = console.error;
  console.info = (message?: unknown) => logs.info.push(String(message));
  console.error = (message?: unknown) => logs.error.push(String(message));

  return {
    logs,
    restore: () => {
      console.info = originalInfo;
      console.error = originalError;
    },
  };
};

const parseLogs = (entries: string[]) => entries.map(entry => JSON.parse(entry));

const startTestServer = async (
  registerRoutes: (app: express.Express) => void,
): Promise<{ server: Server; baseUrl: string }> => {
  const app = express();
  app.use(apiRequestLogger);
  registerRoutes(app);
  app.use(apiErrorHandler);

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
};

const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });

test("logs successful API requests without query strings or sensitive headers", async () => {
  const { logs, restore } = captureLogs();
  const requestId = "11111111-2222-4333-8444-555555555555";
  const { server, baseUrl } = await startTestServer(app => {
    app.get("/api/products", (_request, response) => {
      response.status(200).json({ success: true, data: ["product"] });
    });
  });

  try {
    const response = await fetch(
      `${baseUrl}/api/products?token=query-secret&email=private@example.com`,
      {
        headers: {
          authorization: "Bearer header-secret",
          cookie: "session=cookie-secret",
          "x-request-id": requestId,
        },
      },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { success: true, data: ["product"] });
    assert.equal(response.headers.get("x-request-id"), requestId);

    const records = parseLogs(logs.info);
    assert.deepEqual(records.map(record => record.event), [
      "request.start",
      "request.complete",
    ]);
    assert.equal(records[0].method, "GET");
    assert.equal(records[0].path, "/api/products");
    assert.equal(records[0].requestId, requestId);
    assert.equal(records[1].statusCode, 200);
    assert.equal(records[1].success, true);
    assert.equal(typeof records[1].durationMs, "number");
    assert.equal(records[1].requestId, requestId);

    const serializedLogs = JSON.stringify(records);
    for (const sensitiveValue of [
      "query-secret",
      "private@example.com",
      "header-secret",
      "cookie-secret",
    ]) {
      assert.equal(serializedLogs.includes(sensitiveValue), false);
    }
  } finally {
    restore();
    await closeServer(server);
  }
});

test("logs failed status and unexpected errors with the same request ID without exposing error text", async () => {
  const { logs, restore } = captureLogs();
  const requestId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const { server, baseUrl } = await startTestServer(app => {
    app.get("/api/rejected", (_request, _response, next) => {
      next(new Error("password=do-not-log-this"));
    });
    app.get("/api/unavailable", (_request, response) => {
      response.status(503).json({ success: false, message: "Unavailable" });
    });
  });

  try {
    const failedResponse = await fetch(`${baseUrl}/api/rejected?otp=123456`, {
      headers: { "x-request-id": requestId },
    });
    const failedBody = await failedResponse.json();
    const unavailableResponse = await fetch(`${baseUrl}/api/unavailable`);
    const generatedRequestId = unavailableResponse.headers.get("x-request-id");

    assert.equal(failedResponse.status, 500);
    assert.deepEqual(failedBody, {
      success: false,
      message: "Internal server error",
    });
    assert.equal(JSON.stringify(failedBody).includes("do-not-log-this"), false);
    assert.equal(unavailableResponse.status, 503);
    assert.match(
      generatedRequestId ?? "",
      /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i,
    );

    const requestError = parseLogs(logs.error).find(
      record => record.event === "request.error",
    );
    assert.equal(requestError.method, "GET");
    assert.equal(requestError.path, "/api/rejected");
    assert.equal(requestError.statusCode, 500);
    assert.equal(requestError.requestId, requestId);
    assert.equal(
      JSON.stringify([...parseLogs(logs.info), ...parseLogs(logs.error)]).includes(
        "do-not-log-this",
      ),
      false,
    );

    const unavailableLog = parseLogs(logs.info).find(
      record => record.path === "/api/unavailable" && record.event === "request.complete",
    );
    assert.equal(unavailableLog.statusCode, 503);
    assert.equal(unavailableLog.success, false);
    assert.equal(unavailableLog.requestId, generatedRequestId);
  } finally {
    restore();
    await closeServer(server);
  }
});

test("records a client disconnect once without blocking streaming responses", async () => {
  const { logs, restore } = captureLogs();
  let resolveAborted!: () => void;
  const abortedLog = new Promise<void>(resolve => {
    resolveAborted = resolve;
  });
  const originalInfo = console.info;
  console.info = (message?: unknown) => {
    const serialized = String(message);
    logs.info.push(serialized);
    if (serialized.includes('"event":"request.aborted"')) resolveAborted();
  };

  const { server, baseUrl } = await startTestServer(app => {
    app.get("/api/stream", (_request, response) => {
      response.write("stream chunk");
    });
  });

  try {
    const { get } = await import("node:http");
    const clientRequest = get(`${baseUrl}/api/stream`, response => {
      response.once("data", () => clientRequest.destroy());
    });
    clientRequest.on("error", () => undefined);

    await abortedLog;
    const records = parseLogs(logs.info).filter(
      record => record.path === "/api/stream",
    );
    assert.deepEqual(records.map(record => record.event), [
      "request.start",
      "request.aborted",
    ]);
    assert.equal(records[1].completed, false);
  } finally {
    console.info = originalInfo;
    restore();
    await closeServer(server);
  }
});
