const overlayRoot = document.getElementById("overlayRoot");
const lowerThird = document.getElementById("lowerThird");
const gcText = document.querySelector(".gc-text");
const gcTitle = document.getElementById("gcTitle");
const gcSubtitle = document.getElementById("gcSubtitle");
const logoBox = document.querySelector(".logo-box");
const logoImage = document.getElementById("logoImage");
const likeBar = document.getElementById("likeBar");
const overlayLikeCount = document.getElementById("overlayLikeCount");
const overlayLikeGoal = document.getElementById("overlayLikeGoal");
const overlayLikeFill = document.getElementById("overlayLikeFill");
const likeCelebration = document.getElementById("likeCelebration");
const chatHighlight = document.getElementById("chatHighlight");
const chatHighlightAuthor = document.getElementById("chatHighlightAuthor");
const chatHighlightText = document.getElementById("chatHighlightText");
const supportedPresets = new Set(["classic", "cream", "stadium", "night", "duotone"]);

let currentState = loadOverlayState();
let logoRef = "";
let logoObjectUrl = "";
let activeLikeSignature = "";
let lastGoalVersion = null;
let likePollTimer;
let celebrationTimer;

function renderOverlay(state) {
  currentState = state;
  const style = state.style;
  const preset = supportedPresets.has(state.layout.tarjaPreset) ? state.layout.tarjaPreset : "cream";
  const showLogo = Boolean(state.layout.visible.logo && state.images.logo);

  gcTitle.textContent = state.gcTitle || "";
  gcSubtitle.textContent = state.gcSubtitle || "";
  lowerThird.hidden = !gcTitle.textContent && !gcSubtitle.textContent && !showLogo;
  lowerThird.dataset.preset = preset;
  logoBox.hidden = !showLogo;
  renderLogo(state.images.logo);

  const logoSize = Math.min(lowerThird.clientHeight * Number(style.logoSize) * 0.0075, lowerThird.clientWidth * 0.5);
  lowerThird.style.setProperty("--logo-size", `${logoSize}px`);
  lowerThird.style.setProperty("--logo-x", `${Math.max(0, Math.min(100, Number(style.logoX) || 0))}%`);
  lowerThird.style.setProperty("--logo-y", `${Math.max(0, Math.min(100, Number(style.logoY) || 0))}%`);
  lowerThird.style.setProperty("--gc-surface", withAlpha(style.gcBgColor, Number(style.gcOpacity) / 100));
  lowerThird.style.setProperty("--gc-sheen", withAlpha("#ffffff", Number(style.gcOpacity) / 1000));
  lowerThird.style.setProperty("--gc-glow", withAlpha(style.gcAccentColor, Number(style.gcOpacity) / 450));
  lowerThird.style.setProperty("--gc-border-color", style.gcBorderColor);
  lowerThird.style.setProperty("--gc-accent-color", style.gcAccentColor);
  lowerThird.style.setProperty("--gc-title-surface", withAlpha(style.gcTitleBgColor, Number(style.gcOpacity) / 100));
  lowerThird.style.setProperty("--gc-subtitle-surface", withAlpha(style.gcSubtitleBgColor, Number(style.gcOpacity) / 100));
  gcTitle.style.color = style.gcTitleColor;
  gcSubtitle.style.color = style.gcSubtitleColor;
  likeBar.style.setProperty("--like-surface", withAlpha(style.gcBgColor, 0.94));
  likeBar.style.setProperty("--like-accent", style.gcAccentColor);
  likeBar.style.setProperty("--like-title", style.gcTitleColor);
  likeBar.style.setProperty("--like-subtitle", style.gcSubtitleColor);

  const likeSignature = `${state.youtube?.liveUrl || ""}:${state.youtube?.likeGoal}:${state.youtube?.likeGoalStep}`;
  if (likeSignature !== activeLikeSignature) {
    activeLikeSignature = likeSignature;
    lastGoalVersion = null;
    clearTimeout(likePollTimer);
    likeBar.hidden = !state.youtube?.liveUrl;
    overlayLikeCount.textContent = "—";
    overlayLikeGoal.textContent = Number(state.youtube?.likeGoal || 100).toLocaleString("pt-BR");
    overlayLikeFill.style.width = "0%";
    if (state.youtube?.liveUrl) refreshLikeGoal();
  }

  positionLikeBar(style);

  const textScale = Math.max(0.1, overlayRoot.clientWidth / 1920);
  fitLowerThirdText(style, textScale);
  renderChatHighlight(state.chatHighlight, style, preset);
}

function positionLikeBar(style) {
  if (likeBar.hidden) return;
  const travelX = Math.max(0, overlayRoot.clientWidth - likeBar.offsetWidth);
  const travelY = Math.max(0, overlayRoot.clientHeight - likeBar.offsetHeight);
  const likeX = Math.max(0, Math.min(100, Number(style.likeX) || 0));
  const likeY = Math.max(0, Math.min(100, Number(style.likeY) || 0));
  likeBar.style.left = `${travelX * likeX / 100}px`;
  likeBar.style.top = `${travelY * likeY / 100}px`;
}

function fitLowerThirdText(style, textScale) {
  let titleSize = Number(style.gcTitleSize) * textScale;
  let subtitleSize = Number(style.gcSubtitleSize) * textScale;
  gcTitle.style.fontSize = `${titleSize}px`;
  gcSubtitle.style.fontSize = `${subtitleSize}px`;
  if (lowerThird.hidden) return;

  for (let attempt = 0; attempt < 24 && lowerThirdTextOverflows(); attempt += 1) {
    if (titleSize <= 14 * textScale && subtitleSize <= 10 * textScale) break;
    titleSize = Math.max(14 * textScale, titleSize * 0.9);
    subtitleSize = Math.max(10 * textScale, subtitleSize * 0.9);
    gcTitle.style.fontSize = `${titleSize}px`;
    gcSubtitle.style.fontSize = `${subtitleSize}px`;
  }
}

function lowerThirdTextOverflows() {
  if (gcText.scrollHeight > gcText.clientHeight + 2) return true;
  return lowerThird.dataset.preset === "duotone" && (
    gcTitle.scrollHeight > gcTitle.clientHeight + 3 ||
    gcSubtitle.scrollHeight > gcSubtitle.clientHeight + 3
  );
}

function renderChatHighlight(highlight, style, preset) {
  chatHighlight.hidden = !highlight?.visible || !highlight.text;
  chatHighlight.classList.toggle("standalone", lowerThird.hidden);
  lowerThird.classList.toggle("with-chat", !chatHighlight.hidden);
  if (chatHighlight.hidden) return;
  chatHighlightAuthor.textContent = highlight.author || "Espectador";
  chatHighlightAuthor.title = chatHighlightAuthor.textContent;
  chatHighlightText.textContent = highlight.text;
  chatHighlight.style.setProperty("--chat-bg", withAlpha(style.gcBgColor, 0.94));
  chatHighlight.style.setProperty("--chat-accent-color", style.gcAccentColor);
  chatHighlight.style.setProperty("--chat-title-color", style.gcTitleColor);
  chatHighlight.style.setProperty("--chat-text-color", preset === "duotone" ? style.gcTitleColor : style.gcSubtitleColor);
}

async function refreshLikeGoal() {
  if (!currentState.youtube?.liveUrl) return;
  const signature = activeLikeSignature;
  try {
    const response = await fetch("/youtube/goal", { cache: "no-store" });
    const data = await response.json();
    if (signature !== activeLikeSignature) return;
    if (!response.ok || !data.ok) {
      likeBar.dataset.status = "unavailable";
      likeBar.title = data.error === "youtube_api_unconfigured"
        ? "Configure a API do YouTube no servidor."
        : "Contagem de likes indisponível no momento.";
      return;
    }
    likeBar.hidden = false;
    positionLikeBar(currentState.style);
    likeBar.dataset.status = "connected";
    likeBar.removeAttribute("title");
    overlayLikeCount.textContent = Number(data.likes).toLocaleString("pt-BR");
    overlayLikeGoal.textContent = Number(data.goal).toLocaleString("pt-BR");
    overlayLikeFill.style.width = `${Math.max(0, Math.min(100, Number(data.progress) || 0))}%`;
    if (lastGoalVersion !== null && data.goalVersion > lastGoalVersion) celebrateLikeGoal();
    lastGoalVersion = data.goalVersion;
  } catch {
    if (signature === activeLikeSignature) likeBar.dataset.status = "unavailable";
  } finally {
    if (signature === activeLikeSignature) likePollTimer = setTimeout(refreshLikeGoal, 5000);
  }
}

function celebrateLikeGoal() {
  clearTimeout(celebrationTimer);
  likeCelebration.hidden = false;
  likeBar.classList.remove("goal-reached");
  void likeBar.offsetWidth;
  likeBar.classList.add("goal-reached");
  celebrationTimer = setTimeout(() => {
    likeCelebration.hidden = true;
    likeBar.classList.remove("goal-reached");
  }, 4500);
}

function renderLogo(sourceRef) {
  if (sourceRef === logoRef) return;
  logoRef = sourceRef;
  if (logoObjectUrl) {
    URL.revokeObjectURL(logoObjectUrl);
    logoObjectUrl = "";
  }
  if (!sourceRef) {
    logoImage.removeAttribute("src");
    return;
  }
  if (sourceRef.startsWith("data:") || sourceRef.startsWith("/media/") || sourceRef.startsWith("http://") || sourceRef.startsWith("https://")) {
    logoImage.src = sourceRef;
    return;
  }

  getOverlayMedia("logo")
    .then((record) => {
      if (logoRef !== sourceRef || !record?.blob) return;
      logoObjectUrl = URL.createObjectURL(record.blob);
      logoImage.src = logoObjectUrl;
    })
    .catch(() => {});
}

function withAlpha(hex, alpha) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return "transparent";
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`;
}

renderOverlay(currentState);
loadServerOverlayState().then((serverState) => {
  if (serverState) renderOverlay(serverState);
});
subscribeOverlayState(renderOverlay);
subscribeServerOverlayState(renderOverlay);
window.addEventListener("resize", () => renderOverlay(currentState));
