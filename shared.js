const OVERLAY_STORAGE_KEY = "gc-overlay-state-v3";
const OVERLAY_CHANNEL = "gc-overlay-live-updates";
const OVERLAY_MEDIA_DB = "gc-overlay-media-v1";
const OVERLAY_MEDIA_STORE = "media";
let overlayAdminKey = "";

const tarjaPalettes = {
  classic: { gcTitleColor: "#f4ffff", gcSubtitleColor: "#c4e8e4", gcBgColor: "#10232c", gcBorderColor: "#3ac5b9", gcAccentColor: "#55e5c9", gcTitleBgColor: "#2c5b67", gcSubtitleBgColor: "#152f3b", gcOpacity: 88 },
  cream: { gcTitleColor: "#181c21", gcSubtitleColor: "#3e4243", gcBgColor: "#f3f0e7", gcBorderColor: "#5d6d75", gcAccentColor: "#e07946", gcTitleBgColor: "#eeddd0", gcSubtitleBgColor: "#fff5eb", gcOpacity: 94 },
  stadium: { gcTitleColor: "#ffffff", gcSubtitleColor: "#c6e9ee", gcBgColor: "#12354b", gcBorderColor: "#4ec2d4", gcAccentColor: "#90e070", gcTitleBgColor: "#1a6683", gcSubtitleBgColor: "#134960", gcOpacity: 92 },
  night: { gcTitleColor: "#ffffff", gcSubtitleColor: "#d2cbf0", gcBgColor: "#171829", gcBorderColor: "#8878ed", gcAccentColor: "#b79bff", gcTitleBgColor: "#3b3266", gcSubtitleBgColor: "#252346", gcOpacity: 90 },
  duotone: { gcTitleColor: "#ffffff", gcSubtitleColor: "#ffffff", gcBgColor: "#101d27", gcBorderColor: "#ff9a7a", gcAccentColor: "#ff9a7a", gcTitleBgColor: "#39566b", gcSubtitleBgColor: "#1f3342", gcOpacity: 95 },
};

const defaultOverlayState = {
  gcTitle: "",
  gcSubtitle: "",
  mainKicker: "",
  mainSubtitle: "",
  postAuthor: "",
  postText: "",
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
    gcTitleColor: "#f4ffff",
    gcSubtitleColor: "#c4e8e4",
    gcBgColor: "#10232c",
    gcBorderColor: "#3ac5b9",
    gcAccentColor: "#55e5c9",
    gcTitleBgColor: "#2c5b67",
    gcSubtitleBgColor: "#152f3b",
    gcOpacity: 88,
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
    logoSize: 100,
    logoX: 10,
    logoY: 50,
    likeX: 7,
    likeY: 4,
    likeSize: 100,
  },
  layout: {
    ratio: "landscape",
    tarjaPreset: "classic",
    presetColors: {},
    visible: {
      leftTop: true,
      leftBottom: true,
      main: true,
      post: true,
      logo: true,
    },
  },
  youtube: {
    liveUrl: "",
    likeGoal: 100,
    likeGoalStep: 100,
  },
  chatHighlight: {
    visible: false,
    author: "",
    text: "",
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
  try {
    localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(nextState));
  } catch {}
  publishOverlayState(nextState);
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
  const tarjaPreset = tarjaPalettes[patch.layout?.tarjaPreset]
    ? patch.layout.tarjaPreset
    : patch.layout?.tarjaPreset === "frame" ? "cream" : base.layout.tarjaPreset;
  const legacyStyle = patch.style && patch.style.gcOpacity === undefined;
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
      ...(legacyStyle ? tarjaPalettes[tarjaPreset] : {}),
    },
    layout: {
      ...base.layout,
      ...(patch.layout || {}),
      tarjaPreset,
      presetColors: legacyStyle ? {} : (patch.layout?.presetColors || base.layout.presetColors),
      visible: {
        ...base.layout.visible,
        ...((patch.layout && patch.layout.visible) || {}),
      },
    },
    youtube: {
      ...base.youtube,
      ...(patch.youtube || {}),
    },
    chatHighlight: {
      ...base.chatHighlight,
      ...(patch.chatHighlight || {}),
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
  return requestJson("POST", "/state", state);
}

function getOverlayAdminKey() {
  try {
    const params = new URLSearchParams(window.location.search);
    const keyFromUrl = params.get("key");
    if (keyFromUrl) {
      overlayAdminKey = keyFromUrl;
      try {
        localStorage.setItem("gc-overlay-admin-key", keyFromUrl);
      } catch {}
      params.delete("key");
      const query = params.toString();
      history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
      return keyFromUrl;
    }
    return overlayAdminKey || localStorage.getItem("gc-overlay-admin-key") || "";
  } catch {
    return overlayAdminKey;
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
        const state = JSON.parse(event.data);
        callback(state ? mergeState(defaultOverlayState, state) : cloneDefaultState());
      } catch {}
    });
    events.onerror = () => {};
  }

  const poll = async () => {
    if (stopped) return;
    try {
      const state = await requestJson("GET", `/state?ts=${Date.now()}`);
      const serialized = JSON.stringify(state);
      if (serialized !== lastState) {
        lastState = serialized;
        callback(state ? mergeState(defaultOverlayState, state) : cloneDefaultState());
      }
    } catch {}
  };

  const interval = setInterval(poll, 10000);
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
        const error = new Error(`HTTP ${request.status}`);
        try {
          error.code = JSON.parse(request.responseText).error || "";
        } catch {}
        reject(error);
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
  await uploadMediaToServer(key, file, updatedAt);
  return `/media/${encodeURIComponent(key)}?v=${updatedAt}`;
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
