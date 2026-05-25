const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const MEDIA_DIR = path.join(DATA_DIR, "media");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const MEDIA_META_FILE = path.join(DATA_DIR, "media.json");
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 250) * 1024 * 1024;

const clients = new Set();
const mediaMeta = new Map();

let overlayState = null;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".md": "text/markdown; charset=utf-8",
};

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function bootstrap() {
  await fsp.mkdir(MEDIA_DIR, { recursive: true });
  overlayState = await readJsonFile(STATE_FILE, null);

  const savedMedia = await readJsonFile(MEDIA_META_FILE, {});
  Object.entries(savedMedia).forEach(([key, value]) => mediaMeta.set(key, value));

  const server = http.createServer(handleRequest);
  server.listen(PORT, HOST, () => {
    const localUrl = `http://127.0.0.1:${PORT}`;
    console.log(`GC Overlay server running on ${HOST}:${PORT}`);
    console.log(`Control: ${localUrl}/control.html?v=11`);
    console.log(`Overlay: ${localUrl}/overlay.html?v=11`);
  });
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, { ok: true, uptime: process.uptime() });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/state") {
      sendJson(response, overlayState);
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/state") {
      if (!isAuthorized(request, requestUrl)) {
        sendJson(response, { ok: false, error: "unauthorized" }, 401);
        return;
      }

      overlayState = JSON.parse(await readBody(request, 1_000_000));
      await writeJsonFile(STATE_FILE, overlayState);
      broadcastState();
      sendJson(response, { ok: true });
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/reset") {
      if (!isAuthorized(request, requestUrl)) {
        sendJson(response, { ok: false, error: "unauthorized" }, 401);
        return;
      }

      overlayState = null;
      mediaMeta.clear();
      await Promise.allSettled([
        fsp.rm(STATE_FILE, { force: true }),
        fsp.rm(MEDIA_META_FILE, { force: true }),
        fsp.rm(MEDIA_DIR, { recursive: true, force: true }),
      ]);
      await fsp.mkdir(MEDIA_DIR, { recursive: true });
      broadcastState();
      sendJson(response, { ok: true });
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/events") {
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",
      });
      response.write("\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      if (overlayState) sendStateEvent(response);
      return;
    }

    if (requestUrl.pathname.startsWith("/media/")) {
      await handleMediaRequest(request, response, requestUrl);
      return;
    }

    serveStatic(requestUrl.pathname, response);
  } catch (error) {
    console.error(error);
    sendJson(response, { ok: false, error: "server_error" }, 500);
  }
}

async function handleMediaRequest(request, response, requestUrl) {
  const key = decodeURIComponent(requestUrl.pathname.replace("/media/", ""));

  if (request.method === "PUT") {
    if (!isAuthorized(request, requestUrl)) {
      sendJson(response, { ok: false, error: "unauthorized" }, 401);
      return;
    }

    const body = Buffer.from(await readBody(request, MAX_UPLOAD_BYTES, false));
    const filename = `${safeMediaKey(key)}.bin`;
    const filePath = path.join(MEDIA_DIR, filename);
    const item = {
      contentType: request.headers["content-type"] || "application/octet-stream",
      filename,
      size: body.length,
      updatedAt: Date.now(),
    };

    await fsp.writeFile(filePath, body);
    mediaMeta.set(key, item);
    await writeJsonFile(MEDIA_META_FILE, Object.fromEntries(mediaMeta));

    response.writeHead(204, { "Cache-Control": "no-store" });
    response.end();
    return;
  }

  if (request.method === "GET" && mediaMeta.has(key)) {
    const item = mediaMeta.get(key);
    const filePath = path.join(MEDIA_DIR, item.filename);

    response.writeHead(200, {
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Type": item.contentType,
    });
    fs.createReadStream(filePath).pipe(response);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Media not found");
}

function isAuthorized(request, requestUrl) {
  if (!ADMIN_KEY) return true;
  const providedKey =
    request.headers["x-overlay-key"] ||
    requestUrl.searchParams.get("key") ||
    "";
  return providedKey === ADMIN_KEY;
}

function broadcastState() {
  for (const client of clients) {
    sendStateEvent(client);
  }
}

function sendStateEvent(response) {
  response.write(`event: state\ndata: ${JSON.stringify(overlayState)}\n\n`);
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}

function serveStatic(urlPath, response) {
  const safePath = path
    .normalize(decodeURIComponent(urlPath === "/" ? "/control.html" : urlPath))
    .replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT) || filePath.startsWith(DATA_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(data);
  });
}

function readBody(request, limit, asText = true) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      const body = Buffer.concat(chunks);
      resolve(asText ? body.toString("utf8") : body);
    });
    request.on("error", reject);
  });
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, data) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
}

function safeMediaKey(value) {
  return value.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "media";
}
