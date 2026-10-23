const overlayRoot = document.getElementById("overlayRoot");
const lowerThird = document.getElementById("lowerThird");
const gcText = document.querySelector(".gc-text");
const gcTitle = document.getElementById("gcTitle");
const gcSubtitle = document.getElementById("gcSubtitle");
const logoBox = document.querySelector(".logo-box");
const logoImage = document.getElementById("logoImage");
const chatHighlight = document.getElementById("chatHighlight");
const chatHighlightAuthor = document.getElementById("chatHighlightAuthor");
const chatHighlightText = document.getElementById("chatHighlightText");
const supportedPresets = new Set(["classic", "cream", "stadium", "night", "duotone"]);

let currentState = loadOverlayState();
let logoRef = "";
let logoObjectUrl = "";

function renderOverlay(state) {
  currentState = state;
  const style = state.style;
  const preset = supportedPresets.has(state.layout.tarjaPreset) ? state.layout.tarjaPreset : "cream";
  const showLogo = Boolean(state.layout.visible.logo && state.images.logo);

  gcTitle.textContent = state.gcTitle || "";
  gcSubtitle.textContent = state.gcSubtitle || "";
  lowerThird.hidden = !gcTitle.textContent && !gcSubtitle.textContent && !showLogo;
  lowerThird.dataset.preset = preset;
  lowerThird.classList.toggle("without-logo", !showLogo);
  logoBox.hidden = !showLogo;
  renderLogo(state.images.logo);

  lowerThird.style.setProperty("--logo-scale", String(Number(style.logoSize) / 100));
  lowerThird.style.setProperty("--gc-surface", withAlpha(style.gcBgColor, Number(style.gcOpacity) / 100));
  lowerThird.style.setProperty("--gc-sheen", withAlpha("#ffffff", Number(style.gcOpacity) / 1000));
  lowerThird.style.setProperty("--gc-glow", withAlpha(style.gcAccentColor, Number(style.gcOpacity) / 450));
  lowerThird.style.setProperty("--gc-border-color", style.gcBorderColor);
  lowerThird.style.setProperty("--gc-accent-color", style.gcAccentColor);
  lowerThird.style.setProperty("--gc-title-surface", withAlpha(style.gcTitleBgColor, Number(style.gcOpacity) / 100));
  lowerThird.style.setProperty("--gc-subtitle-surface", withAlpha(style.gcSubtitleBgColor, Number(style.gcOpacity) / 100));
  gcTitle.style.color = style.gcTitleColor;
  gcSubtitle.style.color = style.gcSubtitleColor;

  const textScale = Math.max(0.1, overlayRoot.clientWidth / 1920);
  fitLowerThirdText(style, textScale);
  renderChatHighlight(state.chatHighlight, style, preset);
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
  if (chatHighlight.hidden) return;
  chatHighlightAuthor.textContent = highlight.author || "Espectador";
  chatHighlightText.textContent = highlight.text;
  chatHighlight.style.setProperty("--chat-bg", withAlpha(style.gcBgColor, 0.94));
  chatHighlight.style.setProperty("--chat-accent-color", style.gcAccentColor);
  chatHighlight.style.setProperty("--chat-title-color", style.gcTitleColor);
  chatHighlight.style.setProperty("--chat-text-color", preset === "duotone" ? style.gcTitleColor : style.gcSubtitleColor);
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
