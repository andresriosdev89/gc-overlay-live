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
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 250) * 1024 * 1024;

const clients = new Set();
const mediaMeta = new Map();
const youtubeStatsCache = new Map();
const youtubeStatsInFlight = new Map();
const youtubeChatCache = new Map();

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
    console.log(`Control: ${localUrl}/control.html?v=17`);
    console.log(`Overlay: ${localUrl}/overlay.html?v=17`);
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

    if (request.method === "GET" && requestUrl.pathname === "/youtube/goal") {
      const videoId = getYouTubeVideoId(overlayState?.youtube?.liveUrl || "");
      if (!videoId) {
        sendJson(response, { ok: false, error: "live_not_configured" });
        return;
      }
      if (!YOUTUBE_API_KEY) {
        sendJson(response, { ok: false, error: "youtube_api_unconfigured" }, 503);
        return;
      }
      try {
        const stats = await getYouTubeStats(videoId);
        if (stats.likes === null) {
          sendJson(response, { ok: false, error: "likes_unavailable" }, 502);
          return;
        }
        sendJson(response, { ok: true, likes: stats.likes, ...calculateLikeGoal(stats.likes, overlayState.youtube) });
      } catch (error) {
        sendJson(response, { ok: false, error: error.code || "youtube_unavailable" }, 502);
      }
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/youtube/stats") {
      if (!isAuthorized(request, requestUrl)) {
        sendJson(response, { ok: false, error: "unauthorized" }, 401);
        return;
      }
      if (!YOUTUBE_API_KEY) {
        sendJson(response, { ok: false, error: "youtube_api_unconfigured" }, 503);
        return;
      }
      const videoId = requestUrl.searchParams.get("videoId") || "";
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        sendJson(response, { ok: false, error: "invalid_video_id" }, 400);
        return;
      }
      try {
        const stats = await getYouTubeStats(videoId);
        const goal = getYouTubeVideoId(overlayState?.youtube?.liveUrl || "") === videoId && stats.likes !== null
          ? calculateLikeGoal(stats.likes, overlayState.youtube)
          : null;
        sendJson(response, { ...stats, goal });
      } catch (error) {
        sendJson(response, { ok: false, error: error.code || "youtube_unavailable" }, 502);
      }
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/youtube/chat") {
      if (!isAuthorized(request, requestUrl)) {
        sendJson(response, { ok: false, error: "unauthorized" }, 401);
        return;
      }
      if (!YOUTUBE_API_KEY) {
        sendJson(response, { ok: false, error: "youtube_api_unconfigured" }, 503);
        return;
      }
      const videoId = requestUrl.searchParams.get("videoId") || "";
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        sendJson(response, { ok: false, error: "invalid_video_id" }, 400);
        return;
      }
      try {
        sendJson(response, await getYouTubeChat(videoId));
      } catch (error) {
        sendJson(response, { ok: false, error: error.code || "youtube_unavailable" }, 502);
      }
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

      overlayState = {};
      mediaMeta.clear();
      await Promise.allSettled([
        fsp.rm(MEDIA_META_FILE, { force: true }),
        fsp.rm(MEDIA_DIR, { recursive: true, force: true }),
      ]);
      await fsp.mkdir(MEDIA_DIR, { recursive: true });
      await writeJsonFile(STATE_FILE, overlayState);
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

  if (!filePath.startsWith(ROOT) || filePath.startsWith(DATA_DIR) || safePath.split(/[\\/]/).some((segment) => segment.startsWith("."))) {
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

function getYouTubeVideoId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    let videoId = "";
    if (host === "youtu.be" || host === "www.youtu.be") {
      videoId = url.pathname.split("/")[1];
    } else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      videoId = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:live|embed)\/([^/]+)/)?.[1];
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId || "") ? videoId : "";
  } catch {
    return "";
  }
}

function calculateLikeGoal(likes, youtube) {
  const initialGoal = Math.max(1, Number(youtube.likeGoal) || 1);
  const step = Math.max(1, Number(youtube.likeGoalStep) || 100);
  const goalVersion = likes < initialGoal ? 0 : Math.floor((likes - initialGoal) / step) + 1;
  const goal = initialGoal + goalVersion * step;
  return {
    goal,
    goalVersion,
    reachedGoal: goalVersion ? goal - step : null,
    progress: Math.min(100, Math.round(likes / goal * 100)),
  };
}

async function getYouTubeStats(videoId) {
  const cached = youtubeStatsCache.get(videoId);
  if (cached && Date.now() - cached.cachedAt < 15000) return cached.data;
  if (youtubeStatsInFlight.has(videoId)) return youtubeStatsInFlight.get(videoId);

  const pending = fetchYouTubeStats(videoId);
  youtubeStatsInFlight.set(videoId, pending);
  try {
    return await pending;
  } finally {
    youtubeStatsInFlight.delete(videoId);
  }
}

async function fetchYouTubeStats(videoId) {
  const videoData = await youtubeApiRequest("videos", {
    part: "snippet,statistics,liveStreamingDetails",
    id: videoId,
  });
  const video = videoData.items?.[0];
  if (!video) {
    const error = new Error("video_not_found");
    error.code = "video_not_found";
    throw error;
  }

  let channel;
  try {
    const channelData = await youtubeApiRequest("channels", {
      part: "statistics",
      id: video.snippet.channelId,
    });
    channel = channelData.items?.[0];
  } catch {}
  const stats = {
    videoId,
    likes: video.statistics?.likeCount === undefined ? null : Number(video.statistics.likeCount),
    subscribers: channel?.statistics?.hiddenSubscriberCount || channel?.statistics?.subscriberCount === undefined
      ? null
      : Number(channel.statistics.subscriberCount),
    liveChatId: video.liveStreamingDetails?.activeLiveChatId || "",
    updatedAt: new Date().toISOString(),
  };
  youtubeStatsCache.set(videoId, { data: stats, cachedAt: Date.now() });
  return stats;
}

async function getYouTubeChat(videoId) {
  const cached = youtubeChatCache.get(videoId);
  if (cached && Date.now() < cached.refreshAt) return cached.data;

  const { liveChatId } = await getYouTubeStats(videoId);
  if (!liveChatId) {
    const data = { live: false, messages: [], retryAfterMs: 30000 };
    youtubeChatCache.set(videoId, { data, refreshAt: Date.now() + data.retryAfterMs });
    return data;
  }

  const previous = cached?.liveChatId === liveChatId ? cached : null;
  const params = {
    liveChatId,
    part: "snippet,authorDetails",
    maxResults: "200",
  };
  if (previous?.nextPageToken) params.pageToken = previous.nextPageToken;
  const response = await youtubeApiRequest("liveChat/messages", params);
  const latestMessages = (response.items || [])
    .filter((item) => item.snippet?.type === "textMessageEvent" && item.snippet.displayMessage)
    .map((item) => ({
      id: item.id,
      author: String(item.authorDetails?.displayName || "Espectador").slice(0, 80),
      text: String(item.snippet.displayMessage).slice(0, 500),
    }));
  const seen = new Set();
  const messages = [...(previous?.data.messages || []), ...latestMessages]
    .filter((message) => {
      if (seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    })
    .slice(-40);
  const retryAfterMs = Math.max(15000, Number(response.pollingIntervalMillis) || 20000);
  const data = { live: true, messages, retryAfterMs };
  youtubeChatCache.set(videoId, {
    data,
    liveChatId,
    nextPageToken: response.nextPageToken,
    refreshAt: Date.now() + retryAfterMs,
  });
  return data;
}

async function youtubeApiRequest(resource, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("key", YOUTUBE_API_KEY);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    const reason = (await response.json().catch(() => null))?.error?.errors?.[0]?.reason;
    const code = reason === "quotaExceeded" || reason === "dailyLimitExceeded"
      ? "youtube_quota_exceeded"
      : reason === "liveChatDisabled" || reason === "liveChatEnded" || reason === "liveChatNotFound"
        ? "youtube_chat_unavailable"
      : response.status === 400 || response.status === 401 || response.status === 403
        ? "youtube_key_or_permission_denied"
        : "youtube_unavailable";
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return response.json();
}
