import { execFile, spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, mkdir, stat } from "node:fs/promises";
import http from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { APP_VERSION } from "./version.mjs";

import {
  CoachInputError,
  OLLAMA_BASE_URL,
  checkOllamaHealth,
  createCoachFeedback,
} from "./coach.mjs";

export const LOCAL_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4273;
export const DEFAULT_FRONTEND_PORT = 4272;
const MAX_BODY_BYTES = 64 * 1024;
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function terminateProcessTree(child, options = {}) {
  if (!child || child.exitCode !== null || !Number.isInteger(child.pid)) return;
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    child.kill();
    return;
  }

  const execFileImpl = options.execFileImpl ?? execFile;
  await new Promise((resolve) => {
    execFileImpl(
      "taskkill.exe",
      ["/PID", String(child.pid), "/T", "/F"],
      { windowsHide: true },
      () => resolve(),
    );
  });
}

function parsePort(value, fallback) {
  const port = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(port) && port >= 0 && port <= 65_535 ? port : fallback;
}

function localFrontendUrl(value, port = DEFAULT_FRONTEND_PORT) {
  const candidate = value || `http://${LOCAL_HOST}:${port}`;
  const url = new URL(candidate);
  if (url.protocol !== "http:" || url.hostname !== LOCAL_HOST) {
    throw new Error("The frontend upstream must use http://127.0.0.1 only.");
  }
  return url;
}

function isAllowedLocalOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" &&
      (url.hostname === LOCAL_HOST || url.hostname === "localhost") &&
      url.port === String(DEFAULT_PORT);
  } catch {
    return false;
  }
}

function securityHeaders() {
  return {
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
  };
}

function commonHeaders(contentType) {
  return {
    ...securityHeaders(),
    "cache-control": "no-store",
    "content-type": contentType,
  };
}

function sendJson(response, statusCode, payload, origin) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    ...commonHeaders("application/json; charset=utf-8"),
    "content-length": Buffer.byteLength(body),
    ...(origin && isAllowedLocalOrigin(origin)
      ? { "access-control-allow-origin": origin, vary: "origin" }
      : {}),
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    request.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        reject(new CoachInputError(
          "REQUEST_TOO_LARGE",
          "답변이 너무 깁니다. 핵심 내용만 남겨 주세요.",
          413,
        ));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new CoachInputError("INVALID_JSON", "요청 형식이 올바르지 않습니다."));
      }
    });

    request.on("error", () => {
      if (settled) return;
      settled = true;
      reject(new CoachInputError("REQUEST_READ_ERROR", "요청을 읽을 수 없습니다."));
    });

    request.on("aborted", () => {
      if (settled) return;
      settled = true;
      reject(new CoachInputError("REQUEST_ABORTED", "요청이 취소되었습니다.", 499));
    });
  });
}

function sendStartingPage(response) {
  const body = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="2">
  <title>OPIc Daily Coach 시작 중</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f3ea;color:#16243d;font-family:system-ui,sans-serif}
    main{max-width:34rem;padding:2rem;text-align:center}h1{font-size:1.5rem}p{line-height:1.7;color:#5b6472}
  </style>
</head>
<body><main><h1>OPIc Daily Coach를 시작하고 있어요.</h1><p>로컬 화면을 준비 중입니다. 잠시 뒤 자동으로 다시 연결합니다.</p></main></body>
</html>`;
  response.writeHead(503, {
    ...commonHeaders("text/html; charset=utf-8"),
    "content-length": Buffer.byteLength(body),
    "retry-after": "2",
  });
  response.end(body);
}

function proxyToFrontend(request, response, upstream) {
  const headers = { ...request.headers, host: upstream.host };
  delete headers.forwarded;
  delete headers["x-forwarded-for"];
  delete headers["x-real-ip"];

  const proxyRequest = http.request({
    protocol: "http:",
    hostname: upstream.hostname,
    port: upstream.port,
    method: request.method,
    path: request.url,
    headers,
  }, (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode ?? 502, {
      ...proxyResponse.headers,
      ...securityHeaders(),
    });
    proxyResponse.pipe(response);
  });

  proxyRequest.on("error", () => {
    if (!response.headersSent) sendStartingPage(response);
    else response.destroy();
  });
  request.pipe(proxyRequest);
}

function requestOrigin(request) {
  return typeof request.headers.origin === "string" ? request.headers.origin : "";
}

const STATIC_CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

async function tryServeBundledAsset(request, response, pathname) {
  if ((request.method !== "GET" && request.method !== "HEAD") || !pathname.startsWith("/assets/")) {
    return false;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  const clientRoot = path.resolve(PROJECT_ROOT, "dist", "client");
  const filePath = path.resolve(clientRoot, `.${decodedPath}`);
  if (!filePath.startsWith(`${clientRoot}${path.sep}`)) return false;

  let fileInfo;
  try {
    fileInfo = await stat(filePath);
  } catch {
    return false;
  }
  if (!fileInfo.isFile()) return false;

  response.writeHead(200, {
    ...securityHeaders(),
    "cache-control": "public, max-age=31536000, immutable",
    "content-length": String(fileInfo.size),
    "content-type": STATIC_CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream",
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(filePath).on("error", () => response.destroy()).pipe(response);
  return true;
}

export function createCoachServer(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const frontend = localFrontendUrl(
    options.frontendUrl,
    options.frontendPort ?? DEFAULT_FRONTEND_PORT,
  );
  const logger = options.logger ?? console;

  return http.createServer(async (request, response) => {
    const origin = requestOrigin(request);
    const url = new URL(request.url ?? "/", `http://${LOCAL_HOST}`);

    if (url.pathname.startsWith("/api/") && !isAllowedLocalOrigin(origin)) {
      sendJson(response, 403, {
        ok: false,
        error: { code: "LOCAL_ORIGIN_ONLY", message: "로컬 앱에서만 사용할 수 있습니다." },
      });
      return;
    }

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      response.writeHead(204, {
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        ...(origin ? { "access-control-allow-origin": origin, vary: "origin" } : {}),
      });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      const ollama = await checkOllamaHealth({
        fetchImpl,
        timeoutMs: options.healthTimeoutMs,
      });
      sendJson(response, 200, {
        ok: true,
        service: "opic-daily-coach",
        version: APP_VERSION,
        privacy: "local-only",
        boundHost: LOCAL_HOST,
        coachReady: true,
        mode: ollama.primaryAvailable || ollama.fallbackAvailable
          ? "local-model"
          : "rules-only",
        ollama: {
          endpoint: OLLAMA_BASE_URL,
          ...ollama,
        },
      }, origin);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/coach") {
      const contentType = request.headers["content-type"] ?? "";
      if (!String(contentType).toLowerCase().startsWith("application/json")) {
        sendJson(response, 415, {
          ok: false,
          error: { code: "JSON_REQUIRED", message: "JSON 형식으로 보내 주세요." },
        }, origin);
        return;
      }

      const clientAbortController = new AbortController();
      const abortForClientDisconnect = () => clientAbortController.abort();
      const abortForClosedResponse = () => {
        if (!response.writableEnded) abortForClientDisconnect();
      };
      request.once("aborted", abortForClientDisconnect);
      response.once("close", abortForClosedResponse);

      try {
        const payload = await readJsonBody(request);
        if (clientAbortController.signal.aborted) return;
        const modelHealth = await checkOllamaHealth({
          fetchImpl,
          timeoutMs: options.healthTimeoutMs,
        });
        const availableModels = [
          ...(modelHealth.primaryAvailable ? [modelHealth.primaryModel] : []),
          ...(modelHealth.fallbackAvailable ? [modelHealth.fallbackModel] : []),
        ];
        const feedback = await createCoachFeedback(payload, {
          fetchImpl,
          timeoutMs: options.modelTimeoutMs,
          signal: clientAbortController.signal,
          availableModels,
        });
        if (clientAbortController.signal.aborted || response.destroyed) return;
        sendJson(response, 200, { ok: true, ...feedback }, origin);
      } catch (error) {
        if (clientAbortController.signal.aborted || response.destroyed) return;
        const isInputError = error instanceof CoachInputError;
        const code = isInputError ? error.code : "COACH_ERROR";
        const statusCode = isInputError ? error.statusCode : 500;
        const message = isInputError
          ? error.message
          : "피드백을 준비하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";

        // Never log the exception object: parser/model errors can contain the
        // learner's private Korean or English answer.
        logger.warn?.(`[local-coach] request failed (${code})`);
        sendJson(response, statusCode, {
          ok: false,
          error: { code, message },
        }, origin);
      } finally {
        request.off("aborted", abortForClientDisconnect);
        response.off("close", abortForClosedResponse);
      }
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      sendJson(response, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "지원하지 않는 로컬 API입니다." },
      }, origin);
      return;
    }

    if (await tryServeBundledAsset(request, response, url.pathname)) return;

    proxyToFrontend(request, response, frontend);
  });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function defaultRuntimeRoot() {
  if (process.env.OPIC_DAILY_HOME) return path.resolve(process.env.OPIC_DAILY_HOME);
  if (process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "OPIc-Daily-Coach");
  }
  return PROJECT_ROOT;
}

export async function launchLocalModelEngine(options = {}) {
  if (options.spawnOllama === false) return null;

  const health = await checkOllamaHealth({
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    timeoutMs: 600,
  });
  if (health.reachable) return null;

  const runtimeRoot = path.resolve(options.runtimeRoot ?? defaultRuntimeRoot());
  const executableCandidates = [
    options.ollamaExecutable,
    process.env.OLLAMA_EXE,
    path.join(runtimeRoot, "engine", "ollama", "ollama.exe"),
    ...(process.env.LOCALAPPDATA
      ? [path.join(process.env.LOCALAPPDATA, "Programs", "Ollama", "ollama.exe")]
      : []),
    ...(process.env.ProgramFiles
      ? [path.join(process.env.ProgramFiles, "Ollama", "ollama.exe")]
      : []),
    path.join(PROJECT_ROOT, "runtime", "ollama", "ollama.exe"),
  ].filter(Boolean);
  const executable = (await Promise.all(
    executableCandidates.map(async (candidate) =>
      await fileExists(candidate) ? candidate : null),
  )).find(Boolean);

  if (!executable) return null;

  const modelsPath = path.resolve(
    options.modelsPath ?? process.env.OLLAMA_MODELS ?? path.join(runtimeRoot, "models"),
  );
  await mkdir(modelsPath, { recursive: true });

  return spawn(executable, ["serve"], {
    cwd: path.dirname(executable),
    env: {
      ...process.env,
      OLLAMA_HOST: "127.0.0.1:11435",
      OLLAMA_MODELS: modelsPath,
      OLLAMA_NO_CLOUD: "1",
      OLLAMA_CONTEXT_LENGTH: "4096",
      OLLAMA_FLASH_ATTENTION: "1",
      OLLAMA_KV_CACHE_TYPE: "q8_0",
      OLLAMA_KEEP_ALIVE: "10m",
      OLLAMA_ORIGINS: "http://127.0.0.1:4273",
    },
    stdio: "ignore",
    windowsHide: true,
  });
}

export async function launchProductionFrontend(options = {}) {
  const frontendPort = parsePort(options.port, DEFAULT_FRONTEND_PORT);
  const standaloneEntry = path.join(PROJECT_ROOT, "server.js");
  const cliPath = path.join(PROJECT_ROOT, "node_modules", "vinext", "dist", "cli.js");
  const productionEntry = path.join(PROJECT_ROOT, "dist", "server", "index.js");
  const hasStandalone = await fileExists(standaloneEntry);
  const hasSourceBuild = await fileExists(cliPath) && await fileExists(productionEntry);
  if (!hasStandalone && !hasSourceBuild) return null;

  const args = hasStandalone
    ? [standaloneEntry]
    : [cliPath, "start", "--host", LOCAL_HOST, "--port", String(frontendPort)];
  const child = spawn(process.execPath, args, {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      HOST: LOCAL_HOST,
      PORT: String(frontendPort),
      WRANGLER_WRITE_LOGS: "false",
    },
    stdio: "ignore",
    windowsHide: true,
  });
  child.once("error", () => {});
  return child;
}

export async function startCoachServer(options = {}) {
  const port = parsePort(options.port ?? process.env.DAILY_COACH_PORT, DEFAULT_PORT);
  const frontendPort = parsePort(
    options.frontendPort ?? process.env.DAILY_COACH_FRONTEND_PORT,
    DEFAULT_FRONTEND_PORT,
  );
  const frontendUrl = localFrontendUrl(options.frontendUrl, frontendPort);
  const server = createCoachServer({ ...options, frontendUrl: frontendUrl.href });

  // Acquire the public wrapper port before spawning helpers. A double-click or
  // port conflict then fails without leaving orphan frontend/model processes.
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, LOCAL_HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });

  let ollamaProcess = null;
  let frontendProcess = null;
  try {
    ollamaProcess = await launchLocalModelEngine(options);
    frontendProcess = options.spawnFrontend === false
      ? null
      : await launchProductionFrontend({ port: frontendPort });
  } catch (error) {
    await new Promise((resolve) => server.close(() => resolve()));
    throw error;
  }

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  const close = async () => {
    await Promise.all([
      terminateProcessTree(frontendProcess),
      terminateProcessTree(ollamaProcess),
    ]);
    if (!server.listening) return;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  };

  return {
    server,
    frontendProcess,
    ollamaProcess,
    url: `http://${LOCAL_HOST}:${actualPort}`,
    close,
  };
}

const isMain = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const runtime = await startCoachServer();
  console.log(`OPIc Daily Coach: ${runtime.url}`);
  console.log("Privacy: answers stay on this PC (127.0.0.1 only).");

  const stop = async () => {
    await runtime.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
