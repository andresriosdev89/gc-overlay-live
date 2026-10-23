const textBindings = {
  gcTitle: document.getElementById("gcTitle"),
  gcSubtitle: document.getElementById("gcSubtitle"),
  mainKicker: document.getElementById("mainKicker"),
  mainSubtitle: document.getElementById("mainSubtitle"),
  postAuthor: document.getElementById("postAuthor"),
  postText: document.getElementById("postText"),
};

const imageBindings = {
  leftTop: document.getElementById("leftTopImage"),
  leftBottom: document.getElementById("leftBottomImage"),
  main: document.getElementById("mainImage"),
  post: document.getElementById("postImage"),
  logo: document.getElementById("logoImage"),
};

const videoBindings = {
  main: document.getElementById("mainVideo"),
  post: document.getElementById("postVideo"),
};

const lowerThird = document.getElementById("lowerThird");
const chatHighlight = document.getElementById("chatHighlight");
const chatHighlightAuthor = document.getElementById("chatHighlightAuthor");
const chatHighlightText = document.getElementById("chatHighlightText");
const gcText = document.querySelector(".gc-text");
const storyCaption = document.querySelector(".story-caption");
const postFallback = document.querySelector(".social-fallback");
const overlayRoot = document.getElementById("overlayRoot");
const mediaGrid = document.getElementById("mediaGrid");
const mediaUrls = new Map();
const mediaRenderTokens = new Map();
let currentTextStyle = defaultOverlayState.style;
let textScale = 1;

const windowBindings = {
  leftTop: document.getElementById("leftTopCard"),
  leftBottom: document.getElementById("leftBottomCard"),
  main: document.getElementById("mainCard"),
  post: document.getElementById("postCard"),
};

const styleSetters = {
  gcTitleColor: (value) => textBindings.gcTitle.style.color = value,
  gcSubtitleColor: (value) => textBindings.gcSubtitle.style.color = value,
  gcBgColor: (value) => lowerThird.style.setProperty("--gc-bg-color", value),
  gcBorderColor: (value) => lowerThird.style.setProperty("--gc-border-color", value),
  gcAccentColor: (value) => lowerThird.style.setProperty("--gc-accent-color", value),
  gcTitleBgColor: (value) => lowerThird.style.setProperty("--gc-title-bg-color", value),
  gcSubtitleBgColor: (value) => lowerThird.style.setProperty("--gc-subtitle-bg-color", value),
  mainKickerColor: (value) => textBindings.mainKicker.style.color = value,
  mainKickerBg: (value) => textBindings.mainKicker.style.backgroundColor = withAlpha(value, 0.92),
  mainSubtitleColor: (value) => textBindings.mainSubtitle.style.color = value,
  mainSubtitleBg: (value) => textBindings.mainSubtitle.style.backgroundColor = withAlpha(value, 0.76),
  postTextColor: (value) => {
    textBindings.postAuthor.style.color = value;
    textBindings.postText.style.color = value;
  },
  postBgColor: (value) => document.querySelector(".social-fallback").style.backgroundColor = value,
  gcTitleSize: (value) => textBindings.gcTitle.style.fontSize = `${Number(value) * textScale}px`,
  gcSubtitleSize: (value) => textBindings.gcSubtitle.style.fontSize = `${Number(value) * textScale}px`,
  mainKickerSize: (value) => textBindings.mainKicker.style.fontSize = `${Number(value) * textScale}px`,
  mainSubtitleSize: (value) => textBindings.mainSubtitle.style.fontSize = `${Number(value) * textScale}px`,
  postSize: (value) => {
    textBindings.postAuthor.style.fontSize = `${(Number(value) + 4) * textScale}px`;
    textBindings.postText.style.fontSize = `${Number(value) * textScale}px`;
  },
  logoSize: (value) => lowerThird.style.setProperty("--logo-scale", String(Number(value) / 100)),
};

function renderOverlay(state) {
  currentTextStyle = state.style;
  Object.entries(textBindings).forEach(([key, element]) => {
    element.textContent = state[key] || defaultOverlayState[key];
  });

  Object.entries(imageBindings).forEach(([key, image]) => {
    renderMedia(key, image, state);
  });

  renderLowerThirdBase(state);

  applyLayout(state.layout);
  applyTextStyle(state.style);
  renderChatHighlight(state.chatHighlight, state.style, state.layout.tarjaPreset);
  fitOverlayText();
}

function renderChatHighlight(highlight, style, preset) {
  chatHighlight.hidden = !highlight?.visible || !highlight.text;
  if (chatHighlight.hidden) return;
  chatHighlightAuthor.textContent = highlight.author || "Espectador";
  chatHighlightText.textContent = highlight.text;
  chatHighlight.style.setProperty("--chat-accent-color", style.gcAccentColor);
  chatHighlight.style.setProperty("--chat-border-color", style.gcBorderColor);
  chatHighlight.style.setProperty("--chat-bg-color", style.gcBgColor);
  chatHighlight.style.setProperty("--chat-title-color", style.gcTitleColor);
  chatHighlight.style.setProperty("--chat-text-color", preset === "duotone" ? style.gcTitleColor : style.gcSubtitleColor);
}

function fitOverlayText() {
  fitLowerThirdText();
  fitMainCaption();
  fitPostText();
}

function fitLowerThirdText() {
  let titleSize = Number(currentTextStyle.gcTitleSize) * textScale;
  let subtitleSize = Number(currentTextStyle.gcSubtitleSize) * textScale;
  textBindings.gcTitle.style.fontSize = `${titleSize}px`;
  textBindings.gcSubtitle.style.fontSize = `${subtitleSize}px`;
  for (let attempt = 0; attempt < 24 && lowerThirdTextOverflows(); attempt += 1) {
    if (titleSize <= 16 * textScale && subtitleSize <= 10 * textScale) break;
    titleSize = Math.max(16 * textScale, titleSize * 0.9);
    subtitleSize = Math.max(10 * textScale, subtitleSize * 0.9);
    textBindings.gcTitle.style.fontSize = `${titleSize}px`;
    textBindings.gcSubtitle.style.fontSize = `${subtitleSize}px`;
  }
}

function lowerThirdTextOverflows() {
  if (gcText.scrollHeight > gcText.clientHeight + 1) return true;
  if (lowerThird.dataset.preset !== "duotone") return false;
  return textBindings.gcTitle.scrollHeight > textBindings.gcTitle.clientHeight + 1 ||
    textBindings.gcSubtitle.scrollHeight > textBindings.gcSubtitle.clientHeight + 1;
}

function fitMainCaption() {
  let kickerSize = Number(currentTextStyle.mainKickerSize) * textScale;
  let subtitleSize = Number(currentTextStyle.mainSubtitleSize) * textScale;
  textBindings.mainKicker.style.fontSize = `${kickerSize}px`;
  textBindings.mainSubtitle.style.fontSize = `${subtitleSize}px`;
  for (let attempt = 0; attempt < 24 && storyCaption.scrollHeight > storyCaption.clientHeight + 1; attempt += 1) {
    if (kickerSize <= 14 * textScale && subtitleSize <= 8 * textScale) break;
    kickerSize = Math.max(14 * textScale, kickerSize * 0.9);
    subtitleSize = Math.max(8 * textScale, subtitleSize * 0.9);
    textBindings.mainKicker.style.fontSize = `${kickerSize}px`;
    textBindings.mainSubtitle.style.fontSize = `${subtitleSize}px`;
  }
}

function fitPostText() {
  let authorSize = (Number(currentTextStyle.postSize) + 4) * textScale;
  let bodySize = Number(currentTextStyle.postSize) * textScale;
  textBindings.postAuthor.style.fontSize = `${authorSize}px`;
  textBindings.postText.style.fontSize = `${bodySize}px`;
  for (let attempt = 0; attempt < 24 && postFallback.scrollHeight > postFallback.clientHeight + 1; attempt += 1) {
    if (authorSize <= 12 * textScale && bodySize <= 10 * textScale) break;
    authorSize = Math.max(12 * textScale, authorSize * 0.9);
    bodySize = Math.max(10 * textScale, bodySize * 0.9);
    textBindings.postAuthor.style.fontSize = `${authorSize}px`;
    textBindings.postText.style.fontSize = `${bodySize}px`;
  }
}

function renderMedia(key, image, state) {
  const sourceRef = state.images[key];
  const video = videoBindings[key];
  const card = windowBindings[key] || image.closest(".media-card");
  const explicitType = state.mediaTypes && state.mediaTypes[key];
  const mediaType = explicitType || (sourceRef && sourceRef.startsWith("data:video/") ? "video" : "image");
  const hasMedia = Boolean(sourceRef);
  const token = `${key}:${sourceRef}:${mediaType}`;

  if (card) {
    card.classList.toggle("has-media", hasMedia);
  }
  mediaRenderTokens.set(key, token);

  if (!sourceRef) {
    clearVideo(video);
    image.src = "";
    image.toggleAttribute("data-empty", true);
    return;
  }

  if (sourceRef.startsWith("data:")) {
    showResolvedMedia({ key, image, video, mediaType, source: sourceRef });
    return;
  }

  if (isDirectMediaUrl(sourceRef)) {
    showResolvedMedia({ key, image, video, mediaType, source: sourceRef });
    return;
  }

  getMediaObjectUrl(key, sourceRef)
    .then((source) => {
      if (mediaRenderTokens.get(key) !== token || !source) return;
      showResolvedMedia({ key, image, video, mediaType, source });
    })
    .catch(() => {});
}

function showResolvedMedia({ image, video, mediaType, source }) {
  if (video && mediaType === "video") {
    image.src = "";
    image.toggleAttribute("data-empty", true);
    if (video.src !== source) video.src = source;
    video.toggleAttribute("data-empty", false);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.play().catch(() => {});
    return;
  }

  clearVideo(video);
  if (image.src !== source) image.src = source;
  image.toggleAttribute("data-empty", false);
}

function clearVideo(video) {
  if (!video) return;
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.toggleAttribute("data-empty", true);
}

function renderLowerThirdBase(state) {
  const sourceRef = state.images.gcBase;
  const preset = state.layout.tarjaPreset || "classic";
  const token = `gcBase:${preset}:${sourceRef}`;
  mediaRenderTokens.set("gcBase", token);

  if (!sourceRef || preset !== "classic") {
    lowerThird.style.backgroundImage = "";
    return;
  }

  if (sourceRef.startsWith("data:")) {
    lowerThird.style.backgroundImage = `url("${sourceRef}")`;
    return;
  }

  if (isDirectMediaUrl(sourceRef)) {
    lowerThird.style.backgroundImage = `url("${sourceRef}")`;
    return;
  }

  getMediaObjectUrl("gcBase", sourceRef)
    .then((source) => {
      if (mediaRenderTokens.get("gcBase") !== token || !source) return;
      lowerThird.style.backgroundImage = `url("${source}")`;
    })
    .catch(() => {});
}

async function getMediaObjectUrl(key, ref) {
  const cached = mediaUrls.get(ref);
  if (cached) return cached;

  const record = await getOverlayMedia(key);
  if (!record || !record.blob) return "";

  const url = URL.createObjectURL(record.blob);
  mediaUrls.set(ref, url);
  return url;
}

function isDirectMediaUrl(value) {
  return value.startsWith("/media/") || value.startsWith("http://") || value.startsWith("https://");
}

function applyTextStyle(style) {
  textScale = Math.max(0.1, overlayRoot.clientWidth / (overlayRoot.dataset.ratio === "landscape" ? 1920 : 1080));
  Object.entries(styleSetters).forEach(([key, setter]) => {
    setter(style[key]);
  });
}

function applyLayout(layout) {
  const visible = layout.visible;
  const activeWindows = Object.entries(windowBindings)
    .filter(([key]) => visible[key])
    .map(([key]) => key);

  overlayRoot.dataset.ratio = layout.ratio;
  overlayRoot.dataset.windowCount = String(activeWindows.length);
  lowerThird.dataset.preset = layout.tarjaPreset || "classic";

  Object.entries(windowBindings).forEach(([key, element]) => {
    element.hidden = !visible[key];
  });

  document.querySelector(".logo-box").hidden = !visible.logo;
  lowerThird.classList.toggle("without-logo", !visible.logo);
  setGridTemplate(layout.ratio, activeWindows);
}

function setGridTemplate(ratio, activeWindows) {
  if (activeWindows.length === 0) {
    mediaGrid.style.gridTemplateAreas = '"main"';
    mediaGrid.style.gridTemplateColumns = "1fr";
    mediaGrid.style.gridTemplateRows = "1fr";
    return;
  }

  if (ratio === "vertical") {
    mediaGrid.style.gridTemplateAreas = activeWindows.map((key) => `"${key}"`).join(" ");
    mediaGrid.style.gridTemplateColumns = "1fr";
    mediaGrid.style.gridTemplateRows = `repeat(${activeWindows.length}, minmax(0, 1fr))`;
    return;
  }

  if (ratio === "square") {
    const rows = [];
    for (let index = 0; index < activeWindows.length; index += 2) {
      const first = activeWindows[index];
      const second = activeWindows[index + 1] || first;
      rows.push(`"${first} ${second}"`);
    }
    mediaGrid.style.gridTemplateAreas = rows.join(" ");
    mediaGrid.style.gridTemplateColumns = "1fr 1fr";
    mediaGrid.style.gridTemplateRows = `repeat(${rows.length}, minmax(0, 1fr))`;
    return;
  }

  const hasLeftTop = activeWindows.includes("leftTop");
  const hasLeftBottom = activeWindows.includes("leftBottom");
  const hasMain = activeWindows.includes("main");
  const hasPost = activeWindows.includes("post");
  const leftWindows = [hasLeftTop && "leftTop", hasLeftBottom && "leftBottom"].filter(Boolean);

  if (hasMain && leftWindows.length && hasPost) {
    mediaGrid.style.gridTemplateAreas = leftWindows
      .map((left) => `"${left} main post"`)
      .join(" ");
    mediaGrid.style.gridTemplateColumns = "33.2% minmax(0, 36.2%) 28.2%";
    mediaGrid.style.gridTemplateRows = `repeat(${leftWindows.length}, minmax(0, 1fr))`;
    return;
  }

  if (hasMain && leftWindows.length) {
    mediaGrid.style.gridTemplateAreas = leftWindows.map((left) => `"${left} main"`).join(" ");
    mediaGrid.style.gridTemplateColumns = "34% minmax(0, 1fr)";
    mediaGrid.style.gridTemplateRows = `repeat(${leftWindows.length}, minmax(0, 1fr))`;
    return;
  }

  if (hasMain && hasPost) {
    mediaGrid.style.gridTemplateAreas = '"main post"';
    mediaGrid.style.gridTemplateColumns = "minmax(0, 1fr) 32%";
    mediaGrid.style.gridTemplateRows = "1fr";
    return;
  }

  mediaGrid.style.gridTemplateAreas = `"${activeWindows.join(" ")}"`;
  mediaGrid.style.gridTemplateColumns = `repeat(${activeWindows.length}, minmax(0, 1fr))`;
  mediaGrid.style.gridTemplateRows = "1fr";
}

function withAlpha(hex, alpha) {
  if (!hex || !hex.startsWith("#") || hex.length !== 7) return hex;
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

renderOverlay(loadOverlayState());
loadServerOverlayState().then((serverState) => {
  if (serverState) renderOverlay(serverState);
});
subscribeOverlayState(renderOverlay);
subscribeServerOverlayState(renderOverlay);
window.addEventListener("resize", () => {
  applyTextStyle(currentTextStyle);
  fitOverlayText();
});
