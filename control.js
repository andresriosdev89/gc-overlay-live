getOverlayAdminKey();
let currentState = loadOverlayState();
let saveRevision = 0;
let savedRevision = 0;
let saveTimer;
let saveInProgress = false;
let activeSavePromise = Promise.resolve();
let isResetting = false;
let activeVideoId = "";
let lastLikes = null;
let chatPollTimer;

const form = document.getElementById("controlForm");
const resetButton = document.getElementById("resetButton");
const retryButton = document.getElementById("retryButton");
const saveStatus = document.getElementById("saveStatus");
const liveUrlInput = document.getElementById("liveUrlInput");
const likeGoalInput = document.getElementById("likeGoalInput");
const likeGoalStepInput = document.getElementById("likeGoalStepInput");
const likeCount = document.getElementById("likeCount");
const likeProgress = document.getElementById("likeProgress");
const subscriberCount = document.getElementById("subscriberCount");
const goalTrack = document.getElementById("goalTrack");
const goalFill = document.getElementById("goalFill");
const liveStatus = document.getElementById("liveStatus");
const chatFrame = document.getElementById("chatFrame");
const openChatLink = document.getElementById("openChatLink");
const chatPicker = document.querySelector(".chat-picker");
const chatPickerStatus = document.getElementById("chatPickerStatus");
const chatMessagesList = document.getElementById("chatMessagesList");
const chatHighlightVisibleInput = document.getElementById("chatHighlightVisibleInput");
const tarjaPresetInput = document.getElementById("tarjaPresetInput");
const overlayPreview = document.getElementById("overlayPreview");

const tarjaColorKeys = [
  "gcTitleColor", "gcSubtitleColor", "gcBgColor", "gcBorderColor",
  "gcAccentColor", "gcTitleBgColor", "gcSubtitleBgColor", "gcOpacity",
];

const textInputs = {
  gcTitle: document.getElementById("gcTitleInput"),
  gcSubtitle: document.getElementById("gcSubtitleInput"),
};

const fileInputs = {
  logo: document.getElementById("logoFile"),
};

const styleInputs = {
  gcTitleColor: document.getElementById("gcTitleColorInput"),
  gcSubtitleColor: document.getElementById("gcSubtitleColorInput"),
  gcBgColor: document.getElementById("gcBgColorInput"),
  gcBorderColor: document.getElementById("gcBorderColorInput"),
  gcAccentColor: document.getElementById("gcAccentColorInput"),
  gcTitleBgColor: document.getElementById("gcTitleBgColorInput"),
  gcSubtitleBgColor: document.getElementById("gcSubtitleBgColorInput"),
  gcOpacity: document.getElementById("gcOpacityInput"),
  gcTitleSize: document.getElementById("gcTitleSizeInput"),
  gcSubtitleSize: document.getElementById("gcSubtitleSizeInput"),
  logoSize: document.getElementById("logoSizeInput"),
  logoX: document.getElementById("logoXInput"),
  logoY: document.getElementById("logoYInput"),
  likeX: document.getElementById("likeXInput"),
  likeY: document.getElementById("likeYInput"),
  likeSize: document.getElementById("likeSizeInput"),
  subscriberX: document.getElementById("subscriberXInput"),
  subscriberY: document.getElementById("subscriberYInput"),
  subscriberSize: document.getElementById("subscriberSizeInput"),
};

const styleValueLabels = {
  gcTitleSize: document.getElementById("gcTitleSizeValue"),
  gcSubtitleSize: document.getElementById("gcSubtitleSizeValue"),
  gcOpacity: document.getElementById("gcOpacityValue"),
  logoSize: document.getElementById("logoSizeValue"),
  logoX: document.getElementById("logoXValue"),
  logoY: document.getElementById("logoYValue"),
  likeX: document.getElementById("likeXValue"),
  likeY: document.getElementById("likeYValue"),
  likeSize: document.getElementById("likeSizeValue"),
  subscriberX: document.getElementById("subscriberXValue"),
  subscriberY: document.getElementById("subscriberYValue"),
  subscriberSize: document.getElementById("subscriberSizeValue"),
};

const visibleInputs = {
  logo: document.getElementById("logoVisibleInput"),
  subscribers: document.getElementById("subscribersVisibleInput"),
};

function hydrateForm(state) {
  Object.entries(textInputs).forEach(([key, input]) => {
    input.value = state[key] || "";
  });
  Object.entries(styleInputs).forEach(([key, input]) => {
    input.value = state.style[key];
  });
  updateStyleValueLabels(state);
  tarjaPresetInput.value = state.layout.tarjaPreset;
  Object.entries(visibleInputs).forEach(([key, input]) => {
    input.checked = state.layout.visible[key];
  });
  liveUrlInput.value = state.youtube.liveUrl;
  likeGoalInput.value = state.youtube.likeGoal;
  likeGoalStepInput.value = state.youtube.likeGoalStep;
  renderChatHighlightControls();
  updateLiveDashboard();
}

function updateStyleValueLabels(state) {
  Object.entries(styleValueLabels).forEach(([key, label]) => {
    label.textContent = ["logoSize", "logoX", "logoY", "likeX", "likeY", "likeSize", "subscriberX", "subscriberY", "subscriberSize", "gcOpacity"].includes(key) ? `${state.style[key]}%` : `${state.style[key]}px`;
  });
}

overlayPreview.addEventListener("load", () => {
  const previewDocument = overlayPreview.contentDocument;
  const previewLogo = previewDocument?.querySelector(".logo-box");
  const previewTarja = previewDocument?.getElementById("lowerThird");
  const previewLikeBar = previewDocument?.getElementById("likeBar");
  const previewSubscriberBadge = previewDocument?.getElementById("subscriberBadge");
  const previewFrame = previewDocument?.getElementById("overlayRoot");
  if (!previewLogo || !previewTarja || !previewLikeBar || !previewSubscriberBadge || !previewFrame) return;

  previewLogo.classList.add("editable");
  previewLogo.addEventListener("pointerdown", (event) => {
    if (previewLogo.hidden) return;
    event.preventDefault();
    previewLogo.setPointerCapture(event.pointerId);
    previewLogo.classList.add("dragging");
  });
  previewLogo.addEventListener("pointermove", (event) => {
    if (!previewLogo.hasPointerCapture(event.pointerId)) return;
    const bounds = previewTarja.getBoundingClientRect();
    const logoX = Math.round(Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100)));
    const logoY = Math.round(Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100)));
    styleInputs.logoX.value = logoX;
    styleInputs.logoY.value = logoY;
    updateStyleState();
  });
  const stopDragging = () => previewLogo.classList.remove("dragging");
  previewLogo.addEventListener("pointerup", stopDragging);
  previewLogo.addEventListener("pointercancel", stopDragging);

  function enableCounterDragging(counterElement, horizontalInput, verticalInput) {
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    counterElement.classList.add("editable");
    counterElement.addEventListener("pointerdown", (event) => {
      if (counterElement.hidden) return;
      event.preventDefault();
      const bounds = counterElement.getBoundingClientRect();
      dragOffsetX = event.clientX - bounds.left;
      dragOffsetY = event.clientY - bounds.top;
      counterElement.setPointerCapture(event.pointerId);
      counterElement.classList.add("dragging");
    });
    counterElement.addEventListener("pointermove", (event) => {
      if (!counterElement.hasPointerCapture(event.pointerId)) return;
      const bounds = previewFrame.getBoundingClientRect();
      const counterBounds = counterElement.getBoundingClientRect();
      const travelX = Math.max(0, bounds.width - counterBounds.width);
      const travelY = Math.max(0, bounds.height - counterBounds.height);
      const left = Math.max(0, Math.min(travelX, event.clientX - bounds.left - dragOffsetX));
      const top = Math.max(0, Math.min(travelY, event.clientY - bounds.top - dragOffsetY));
      horizontalInput.value = travelX ? Math.round(left / travelX * 100) : 0;
      verticalInput.value = travelY ? Math.round(top / travelY * 100) : 0;
      updateStyleState();
    });
    const stopCounterDragging = () => counterElement.classList.remove("dragging");
    counterElement.addEventListener("pointerup", stopCounterDragging);
    counterElement.addEventListener("pointercancel", stopCounterDragging);
  }

  enableCounterDragging(previewLikeBar, styleInputs.likeX, styleInputs.likeY);
  enableCounterDragging(previewSubscriberBadge, styleInputs.subscriberX, styleInputs.subscriberY);
});

function updateTextState() {
  const patch = {};
  Object.entries(textInputs).forEach(([key, input]) => {
    patch[key] = input.value;
  });
  queueState({ ...currentState, ...patch });
}

function updateStyleState() {
  const style = { ...currentState.style };
  Object.entries(styleInputs).forEach(([key, input]) => {
    style[key] = input.type === "range" ? Number(input.value) : input.value;
  });
  const presetColors = {
    ...currentState.layout.presetColors,
    [currentState.layout.tarjaPreset]: pickTarjaColors(style),
  };
  queueState({
    ...currentState,
    style,
    layout: { ...currentState.layout, presetColors },
  });
  updateStyleValueLabels(currentState);
}

function pickTarjaColors(style) {
  return Object.fromEntries(tarjaColorKeys.map((key) => [key, style[key]]));
}

function updateTarjaPresetState() {
  const preset = tarjaPresetInput.value;
  const currentPreset = currentState.layout.tarjaPreset;
  if (preset === currentPreset) return;
  const presetColors = {
    ...currentState.layout.presetColors,
    [currentPreset]: pickTarjaColors(currentState.style),
  };
  const colors = { ...tarjaPalettes[preset], ...presetColors[preset] };
  queueState({
    ...currentState,
    style: { ...currentState.style, ...colors },
    layout: { ...currentState.layout, tarjaPreset: preset, presetColors },
  }, true);
  tarjaColorKeys.forEach((key) => {
    styleInputs[key].value = currentState.style[key];
  });
  updateStyleValueLabels(currentState);
}

function updateLayoutState() {
  const visible = { ...currentState.layout.visible };
  Object.entries(visibleInputs).forEach(([key, input]) => {
    visible[key] = input.checked;
  });

  queueState({
    ...currentState,
    layout: {
      ...currentState.layout,
      visible,
    },
  });
}

function setSaveStatus(message, kind = "neutral") {
  saveStatus.textContent = message;
  saveStatus.dataset.kind = kind;
}

function queueState(state, immediate = false) {
  currentState = saveOverlayState(state);
  saveRevision += 1;
  retryButton.hidden = true;
  setSaveStatus("Alterações pendentes...");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, immediate ? 0 : 400);
}

async function flushSave() {
  if (isResetting || saveInProgress || saveRevision === savedRevision) return;
  const revision = saveRevision;
  const snapshot = currentState;
  saveInProgress = true;
  setSaveStatus("Salvando no servidor...");
  try {
    activeSavePromise = syncOverlayStateToServer(snapshot);
    await activeSavePromise;
    savedRevision = revision;
    if (saveRevision === revision) {
      retryButton.hidden = true;
      setSaveStatus("Salvo no servidor.", "success");
    }
  } catch (error) {
    retryButton.hidden = false;
    setSaveStatus(error.message === "HTTP 401" ? "Acesso negado. Abra o painel com uma chave válida." : "Não foi possível salvar no servidor. O OBS pode estar desatualizado.", "error");
  } finally {
    saveInProgress = false;
    if (!isResetting && saveRevision > revision) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 0);
    }
  }
}

form.addEventListener("input", (event) => {
  if (Object.values(textInputs).includes(event.target)) {
    updateTextState();
    return;
  }

  if (Object.values(styleInputs).includes(event.target)) {
    updateStyleState();
  }
});

form.addEventListener("change", (event) => {
  if (event.target === tarjaPresetInput) {
    updateTarjaPresetState();
  } else if (Object.values(visibleInputs).includes(event.target)) {
    updateLayoutState();
  }
});

Object.entries(fileInputs).forEach(([key, input]) => {
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;

    input.disabled = true;
    setSaveStatus("Enviando mídia...");
    try {
      const mediaRef = await saveOverlayMedia(key, file);

      queueState({
        ...currentState,
        images: {
          ...currentState.images,
          [key]: mediaRef,
        },
        mediaTypes: {
          ...currentState.mediaTypes,
          [key]: file.type.startsWith("video/") ? "video" : "image",
        },
      }, true);
    } catch (error) {
      setSaveStatus(error.message === "HTTP 401" ? "Acesso negado para enviar mídia. Confira a chave do painel." : "Falha no envio da mídia. O arquivo anterior continua no overlay.", "error");
    } finally {
      input.disabled = false;
    }
  });
});

resetButton.addEventListener("click", async () => {
  if (!window.confirm("Resetar textos, configurações e mídias do overlay para todos os espectadores?")) return;
  isResetting = true;
  form.inert = true;
  resetButton.disabled = true;
  clearTimeout(saveTimer);
  setSaveStatus("Resetando...");
  try {
    await activeSavePromise.catch(() => {});
    await requestJson("POST", "/reset");
    await clearOverlayMedia().catch(() => {});
    currentState = saveOverlayState(cloneDefaultState());
    saveRevision = 0;
    savedRevision = 0;
    hydrateForm(currentState);
    Object.values(fileInputs).forEach((input) => {
      input.value = "";
    });
    setSaveStatus("Overlay resetado.", "success");
  } catch {
    setSaveStatus("Não foi possível concluir o reset. Confira a conexão.", "error");
  } finally {
    isResetting = false;
    form.inert = false;
    resetButton.disabled = false;
  }
});

retryButton.addEventListener("click", flushSave);

chatHighlightVisibleInput.addEventListener("change", () => {
  queueState({
    ...currentState,
    chatHighlight: { ...currentState.chatHighlight, visible: chatHighlightVisibleInput.checked },
  }, true);
});

liveUrlInput.addEventListener("input", updateYouTubeState);
likeGoalInput.addEventListener("input", updateYouTubeState);
likeGoalStepInput.addEventListener("input", updateYouTubeState);

function updateYouTubeState() {
  const likeGoal = Math.max(1, Number(likeGoalInput.value) || 1);
  const likeGoalStep = Math.max(1, Number(likeGoalStepInput.value) || 1);
  queueState({
    ...currentState,
    youtube: { ...currentState.youtube, liveUrl: liveUrlInput.value.trim(), likeGoal, likeGoalStep },
  });
  updateLiveDashboard();
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

function updateLiveDashboard() {
  const videoId = getYouTubeVideoId(currentState.youtube.liveUrl);
  if (videoId !== activeVideoId) lastLikes = null;
  updateGoalProgress(lastLikes);
  if (videoId === activeVideoId) return;
  activeVideoId = videoId;
  likeCount.textContent = "—";
  subscriberCount.textContent = "—";
  chatFrame.replaceChildren();
  openChatLink.hidden = true;
  chatMessagesList.replaceChildren();
  clearTimeout(chatPollTimer);

  if (!videoId) {
    liveStatus.textContent = currentState.youtube.liveUrl ? "Use um link válido de live do YouTube." : "Cole o link da live para acompanhar.";
    chatPickerStatus.textContent = "Cole um link válido da live para selecionar mensagens.";
    return;
  }

  const chatUrl = new URL("https://www.youtube.com/live_chat");
  chatUrl.searchParams.set("v", videoId);
  chatUrl.searchParams.set("embed_domain", window.location.hostname);
  const iframe = document.createElement("iframe");
  iframe.title = "Chat ao vivo do YouTube";
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin";
  iframe.src = chatUrl.toString();
  chatFrame.append(iframe);
  openChatLink.href = `https://www.youtube.com/live_chat?v=${encodeURIComponent(videoId)}`;
  openChatLink.textContent = "Abrir chat no YouTube";
  openChatLink.hidden = false;
  refreshYouTubeStats();
  refreshYouTubeChat();
}

function renderChatHighlightControls() {
  chatHighlightVisibleInput.checked = Boolean(currentState.chatHighlight.visible && currentState.chatHighlight.text);
  chatHighlightVisibleInput.disabled = !currentState.chatHighlight.text;
}

async function refreshYouTubeChat() {
  const videoId = activeVideoId;
  if (!videoId) return;
  chatPickerStatus.textContent = "Buscando mensagens recentes do chat...";
  let retryAfterMs = 30000;
  try {
    const chat = await requestJson("GET", `/youtube/chat?videoId=${encodeURIComponent(videoId)}`);
    if (videoId !== activeVideoId) return;
    retryAfterMs = Math.max(15000, Number(chat.retryAfterMs) || 20000);
    chatMessagesList.replaceChildren();
    if (!chat.live) {
      chatPickerStatus.textContent = "A live ainda não está ativa ou o chat está desativado.";
    } else if (!chat.messages.length) {
      chatPickerStatus.textContent = "Nenhuma mensagem de texto recente. Aguardando o chat...";
    } else {
      chatPickerStatus.textContent = `Selecione uma das ${chat.messages.length} mensagens recentes para destacá-la no overlay.`;
      chat.messages.slice().reverse().forEach((message) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-message-button";
        const author = document.createElement("strong");
        author.textContent = message.author;
        const content = document.createElement("span");
        content.textContent = message.text;
        button.append(author, content);
        button.addEventListener("click", () => {
          queueState({
            ...currentState,
            chatHighlight: { visible: true, author: message.author, text: message.text },
          }, true);
          renderChatHighlightControls();
        });
        chatMessagesList.append(button);
      });
    }
  } catch (error) {
    if (videoId !== activeVideoId) return;
    chatPickerStatus.textContent = error.code === "youtube_api_unconfigured"
      ? "Para selecionar mensagens, configure a API do YouTube no servidor."
      : error.code === "youtube_quota_exceeded"
        ? "Cota da API do YouTube esgotada; o chat incorporado ainda pode funcionar."
        : error.code === "youtube_chat_unavailable"
          ? "O chat desta live não está mais disponível pela API."
        : error.code === "youtube_key_or_permission_denied"
          ? "A API não autorizou a leitura do chat. Confira a chave e as permissões."
          : "Não foi possível ler o chat agora. Nova tentativa automática em instantes.";
  } finally {
    if (videoId === activeVideoId) chatPollTimer = setTimeout(refreshYouTubeChat, retryAfterMs);
  }
}

async function refreshYouTubeStats() {
  const videoId = activeVideoId;
  if (!videoId) return;
  liveStatus.textContent = "Atualizando dados do YouTube...";
  try {
    const stats = await requestJson("GET", `/youtube/stats?videoId=${encodeURIComponent(videoId)}`);
    if (videoId !== activeVideoId) return;
    const likes = stats.likes === null ? null : Number(stats.likes);
    const subscribers = stats.subscribers === null ? null : Number(stats.subscribers);
    lastLikes = Number.isFinite(likes) ? likes : null;
    likeCount.textContent = Number.isFinite(likes) ? likes.toLocaleString("pt-BR") : "—";
    subscriberCount.textContent = Number.isFinite(subscribers) ? subscribers.toLocaleString("pt-BR") : "—";
    updateGoalProgress(lastLikes);
    liveStatus.textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. A meta avança automaticamente; inscritos são aproximados pelo YouTube.`;
  } catch (error) {
    if (videoId !== activeVideoId) return;
    liveStatus.textContent = error.code === "youtube_api_unconfigured"
      ? "Contadores aguardando a chave da API do YouTube no servidor."
      : error.code === "youtube_quota_exceeded"
        ? "Cota diária da API do YouTube esgotada."
        : error.code === "youtube_key_or_permission_denied"
          ? "Chave da API sem permissão ou inválida para este servidor."
          : "Não foi possível atualizar os contadores do YouTube.";
  }
}

function updateGoalProgress(likes) {
  const initialGoal = Math.max(1, Number(currentState.youtube.likeGoal) || 1);
  const step = Math.max(1, Number(currentState.youtube.likeGoalStep) || 100);
  const goalVersion = Number.isFinite(likes) && likes >= initialGoal ? Math.floor((likes - initialGoal) / step) + 1 : 0;
  const goal = initialGoal + goalVersion * step;
  const percent = Number.isFinite(likes) ? Math.min(100, Math.round(likes / goal * 100)) : 0;
  likeProgress.textContent = goal.toLocaleString("pt-BR");
  goalFill.style.width = `${percent}%`;
  goalTrack.setAttribute("aria-valuenow", String(percent));
}

form.inert = true;
chatPicker.inert = true;
resetButton.disabled = true;
hydrateForm(currentState);

requestJson("GET", `/state?ts=${Date.now()}`)
  .then((serverState) => {
    if (serverState) {
      currentState = saveOverlayState(mergeState(defaultOverlayState, serverState));
      hydrateForm(currentState);
      setSaveStatus("Último conteúdo carregado do servidor.", "success");
    } else if (localStorage.getItem(OVERLAY_STORAGE_KEY)) {
      queueState(currentState, true);
    } else {
      setSaveStatus("Pronto para editar.", "success");
    }
  })
  .catch(() => {
    setSaveStatus("Servidor indisponível. Alterações locais serão enviadas quando você editar e tentar salvar.", "error");
  })
  .finally(() => {
    form.inert = false;
    chatPicker.inert = false;
    resetButton.disabled = false;
  });

setInterval(refreshYouTubeStats, 15000);
