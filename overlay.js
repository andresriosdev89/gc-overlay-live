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
const overlayRoot = document.getElementById("overlayRoot");
const mediaGrid = document.getElementById("mediaGrid");
const mediaUrls = new Map();
const mediaRenderTokens = new Map();

const windowBindings = {
  leftTop: document.getElementById("leftTopCard"),
  leftBottom: document.getElementById("leftBottomCard"),
  main: document.getElementById("mainCard"),
  post: document.getElementById("postCard"),
};

const styleSetters = {
  gcTitleColor: (value) => textBindings.gcTitle.style.color = value,
  gcSubtitleColor: (value) => textBindings.gcSubtitle.style.color = value,
  mainKickerColor: (value) => textBindings.mainKicker.style.color = value,
  mainKickerBg: (value) => textBindings.mainKicker.style.backgroundColor = withAlpha(value, 0.92),
  mainSubtitleColor: (value) => textBindings.mainSubtitle.style.color = value,
  mainSubtitleBg: (value) => textBindings.mainSubtitle.style.backgroundColor = withAlpha(value, 0.76),
  postTextColor: (value) => {
    textBindings.postAuthor.style.color = value;
    textBindings.postText.style.color = value;
  },
  postBgColor: (value) => document.querySelector(".social-fallback").style.backgroundColor = value,
  gcTitleSize: (value) => textBindings.gcTitle.style.fontSize = `${value}px`,
  gcSubtitleSize: (value) => textBindings.gcSubtitle.style.fontSize = `${value}px`,
  mainKickerSize: (value) => textBindings.mainKicker.style.fontSize = `${value}px`,
  mainSubtitleSize: (value) => textBindings.mainSubtitle.style.fontSize = `${value}px`,
  postSize: (value) => {
    textBindings.postAuthor.style.fontSize = `${Number(value) + 4}px`;
    textBindings.postText.style.fontSize = `${value}px`;
  },
};

function renderOverlay(state) {
  Object.entries(textBindings).forEach(([key, element]) => {
    element.textContent = state[key] || defaultOverlayState[key];
  });

  Object.entries(imageBindings).forEach(([key, image]) => {
    renderMedia(key, image, state);
  });

  renderLowerThirdBase(state);

  applyTextStyle(state.style);
  applyLayout(state.layout);
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
  const token = `gcBase:${sourceRef}`;
  mediaRenderTokens.set("gcBase", token);

  if (!sourceRef) {
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
