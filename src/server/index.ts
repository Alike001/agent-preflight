import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { parseWorkflowBytes } from "../input/parse-workflow";
import { loadServerConfig } from "./config";
import { runPreflight } from "./scan-service";
import { createServTransport } from "./serv-client";
import { UsageGuard } from "./usage-guard";

const config = loadServerConfig();
const app = express();
const guard = new UsageGuard(config);
const unavailableTransport: ReturnType<typeof createServTransport> = () =>
  Promise.reject(new Error("SERV_API_KEY is not configured."));
const transport = config.servApiKey
  ? createServTransport(config.servApiKey, config.servModel)
  : unavailableTransport;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "260kb", strict: true }));

app.post("/api/preflight", async (request, response) => {
  const sessionId = readSessionId(request.headers.cookie) ?? randomUUID();
  response.cookie("agent_preflight_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000,
  });

  const rawWorkflow = isRecord(request.body)
    ? request.body.workflow
    : undefined;
  const parsed = parseWorkflowBytes(
    new TextEncoder().encode(JSON.stringify(rawWorkflow)),
  );
  if (!parsed.ok) {
    response
      .status(400)
      .json({ code: "INPUT_REJECTED", issues: parsed.issues });
    return;
  }

  try {
    const report = await runPreflight(
      parsed.workflow,
      { sessionId, ip: request.ip ?? "unknown" },
      config,
      guard,
      transport,
    );
    response.status(200).json(report);
  } catch {
    response.status(422).json({
      code: "SEMANTIC_PROJECTION_REJECTED",
      message:
        "The workflow could not be safely prepared for semantic review. No SERV request was sent.",
    });
  }
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) => {
    if (!error) return next();
    response.status(400).json({
      code: "INPUT_INVALID_JSON",
      message: "The request body must contain one valid JSON object.",
    });
  },
);

if (process.env.NODE_ENV === "production") {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const clientDir = path.resolve(root, "../dist");
  app.use(express.static(clientDir));
  app.get("/{*path}", (_request, response) =>
    response.sendFile(path.join(clientDir, "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.listen(config.port, "127.0.0.1", () => {
  process.stdout.write(
    `Agent Preflight listening on http://127.0.0.1:${config.port}\n`,
  );
});

function readSessionId(cookieHeader: string | undefined): string | undefined {
  const match = cookieHeader?.match(
    /(?:^|;\s*)agent_preflight_session=([A-Za-z0-9-]{20,80})(?:;|$)/,
  );
  return match?.[1];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
