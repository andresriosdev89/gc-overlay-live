const OVERLAY_STORAGE_KEY = "gc-overlay-state-v3";
const OVERLAY_CHANNEL = "gc-overlay-live-updates";
const OVERLAY_MEDIA_DB = "gc-overlay-media-v1";
const OVERLAY_MEDIA_STORE = "media";

const defaultOverlayState = {
  gcTitle: "ANCELOTTI RENOVOU COM A SELECAO!",
  gcSubtitle: "NOVO VINCULO DO TREINADOR VAI ATE A COPA DE 2030",
  mainKicker: "PODE PINTAR ENTRE OS 26!",
  mainSubtitle:
    "A convocacao de Neymar para a Copa do Mundo ainda esta na pauta do tecnico.",
  postAuthor: "Instagram",
  postText: "Insira o print do post lateral ou use este campo como texto reserva.",
  images: {
    leftTop: "",
    leftBottom: "",
    main: "",
    post: "",
    logo: "",
    gcBase: "",
  },
  mediaTypes: {
    leftTop: "image",
    leftBottom: "image",
    main: "image",
    post: "image",
    logo: "image",
    gcBase: "image",
  },
  style: {
    gcTitleColor: "#151515",
    gcSubtitleColor: "#222222",
    mainKickerColor: "#282828",
    mainKickerBg: "#ffffff",
    mainSubtitleColor: "#ffffff",
    mainSubtitleBg: "#111111",
    postTextColor: "#1d1d1d",
    postBgColor: "#ffffff",
    gcTitleSize: 58,
    gcSubtitleSize: 28,
    mainKickerSize: 34,
    mainSubtitleSize: 15,
    postSize: 19,
  },
  layout: {
    ratio: "landscape",
    visible: {
      leftTop: true,
      leftBottom: true,
      main: true,
      post: true,
      logo: true,
    },
  },
};

function loadOverlayState() {
  try {
    const saved = JSON.parse(localStorage.getItem(OVERLAY_STORAGE_KEY));
    return mergeState(defaultOverlayState, saved || {});
  } catch {
    return cloneDefaultState();
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultOverlayState));
}

function saveOverlayState(state) {
  const nextState = stripInlineMedia(mergeState(defaultOverlayState, state));
  localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(nextState));
  publishOverlayState(nextState);
  syncOverlayStateToServer(nextState);
  return nextState;
}

function stripInlineMedia(state) {
  const images = { ...state.images };
  Object.entries(images).forEach(([key, value]) => {
    if (typeof value === "string" && value.startsWith("data:")) {
      images[key] = "";
    }
  });
  return { ...state, images };
}

function mergeState(base, patch) {
  return {
    ...base,
    ...patch,
    images: {
      ...base.images,
      ...(patch.images || {}),
    },
    mediaTypes: {
      ...base.mediaTypes,
      ...(patch.mediaTypes || {}),
    },
    style: {
      ...base.style,
      ...(patch.style || {}),
    },
    layout: {
      ...base.layout,
      ...(patch.layout || {}),
      visible: {
        ...base.layout.visible,
        ...((patch.layout && patch.layout.visible) || {}),
      },
    },
  };
}

function publishOverlayState(state) {
  window.dispatchEvent(new CustomEvent("overlay-state", { detail: state }));

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(OVERLAY_CHANNEL);
    channel.postMessage(state);
    channel.close();
  }
}

function subscribeOverlayState(callback) {
  const handleStorage = (event) => {
    if (event.key === OVERLAY_STORAGE_KEY) {
      callback(loadOverlayState());
    }
  };

  const handleCustom = (event) => callback(event.detail);
  window.addEventListener("storage", handleStorage);
  window.addEventListener("overlay-state", handleCustom);

  let channel;
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(OVERLAY_CHANNEL);
    channel.onmessage = (event) => callback(event.data);
  }

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("overlay-state", handleCustom);
    if (channel) channel.close();
  };
}

async function loadServerOverlayState() {
  try {
    const serverState = await requestJson("GET", `/state?ts=${Date.now()}`);
    return serverState ? mergeState(defaultOverlayState, serverState) : null;
  } catch {
    return null;
  }
}

function syncOverlayStateToServer(state) {
  requestJson("POST", "/state", state).catch(() => {});
}

function getOverlayAdminKey() {
  try {
    const params = new URLSearchParams(window.location.search);
    const keyFromUrl = params.get("key");
    if (keyFromUrl) {
      localStorage.setItem("gc-overlay-admin-key", keyFromUrl);
      return keyFromUrl;
    }
    return localStorage.getItem("gc-overlay-admin-key") || "";
  } catch {
    return "";
  }
}

function subscribeServerOverlayState(callback) {
  let lastState = "";
  let stopped = false;
  let events;

  if ("EventSource" in window) {
    events = new EventSource("/events");
    events.addEventListener("state", (event) => {
      try {
        lastState = event.data;
        callback(mergeState(defaultOverlayState, JSON.parse(event.data)));
      } catch {}
    });
    events.onerror = () => {};
  }

  const poll = async () => {
    if (stopped) return;
    try {
      const state = await requestJson("GET", `/state?ts=${Date.now()}`);
      const serialized = JSON.stringify(state);
      if (state && serialized !== lastState) {
        lastState = serialized;
        callback(mergeState(defaultOverlayState, state));
      }
    } catch {}
  };

  const interval = setInterval(poll, 250);
  poll();

  return () => {
    stopped = true;
    clearInterval(interval);
    if (events) events.close();
  };
}

function requestJson(method, url, data) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url, true);
    request.setRequestHeader("Cache-Control", "no-store");
    const adminKey = getOverlayAdminKey();
    if (adminKey) request.setRequestHeader("X-Overlay-Key", adminKey);
    if (data !== undefined) {
      request.setRequestHeader("Content-Type", "application/json");
    }
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`HTTP ${request.status}`));
        return;
      }
      try {
        resolve(request.responseText ? JSON.parse(request.responseText) : null);
      } catch {
        resolve(null);
      }
    };
    request.onerror = () => reject(new Error("Network error"));
    request.send(data === undefined ? null : JSON.stringify(data));
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function openOverlayMediaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OVERLAY_MEDIA_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OVERLAY_MEDIA_STORE)) {
        db.createObjectStore(OVERLAY_MEDIA_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveOverlayMedia(key, file) {
  const updatedAt = Date.now();
  const mediaRef = `${key}:${updatedAt}:${file.name}`;

  try {
    await uploadMediaToServer(key, file, updatedAt);
    return `/media/${encodeURIComponent(key)}?v=${updatedAt}`;
  } catch {}

  const db = await openOverlayMediaDb();
  const record = {
    key,
    blob: file,
    mimeType: file.type,
    name: file.name,
    updatedAt,
  };

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(OVERLAY_MEDIA_STORE, "readwrite");
    transaction.objectStore(OVERLAY_MEDIA_STORE).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
  return mediaRef;
}

function uploadMediaToServer(key, file, updatedAt) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", `/media/${encodeURIComponent(key)}?v=${updatedAt}`, true);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    const adminKey = getOverlayAdminKey();
    if (adminKey) request.setRequestHeader("X-Overlay-Key", adminKey);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error(`HTTP ${request.status}`));
      }
    };
    request.onerror = () => reject(new Error("Network error"));
    request.send(file);
  });
}

async function getOverlayMedia(key) {
  const db = await openOverlayMediaDb();

  const record = await new Promise((resolve, reject) => {
    const transaction = db.transaction(OVERLAY_MEDIA_STORE, "readonly");
    const request = transaction.objectStore(OVERLAY_MEDIA_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return record;
}

async function clearOverlayMedia() {
  const db = await openOverlayMediaDb();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(OVERLAY_MEDIA_STORE, "readwrite");
    transaction.objectStore(OVERLAY_MEDIA_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
}
