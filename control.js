let currentState = loadOverlayState();

const form = document.getElementById("controlForm");
const resetButton = document.getElementById("resetButton");

const textInputs = {
  gcTitle: document.getElementById("gcTitleInput"),
  gcSubtitle: document.getElementById("gcSubtitleInput"),
  mainKicker: document.getElementById("mainKickerInput"),
  mainSubtitle: document.getElementById("mainSubtitleInput"),
  postAuthor: document.getElementById("postAuthorInput"),
  postText: document.getElementById("postTextInput"),
};

const fileInputs = {
  leftTop: document.getElementById("leftTopFile"),
  leftBottom: document.getElementById("leftBottomFile"),
  main: document.getElementById("mainFile"),
  post: document.getElementById("postFile"),
  logo: document.getElementById("logoFile"),
  gcBase: document.getElementById("gcBaseFile"),
};

const styleInputs = {
  gcTitleColor: document.getElementById("gcTitleColorInput"),
  gcSubtitleColor: document.getElementById("gcSubtitleColorInput"),
  mainKickerColor: document.getElementById("mainKickerColorInput"),
  mainKickerBg: document.getElementById("mainKickerBgInput"),
  mainSubtitleColor: document.getElementById("mainSubtitleColorInput"),
  mainSubtitleBg: document.getElementById("mainSubtitleBgInput"),
  postTextColor: document.getElementById("postTextColorInput"),
  postBgColor: document.getElementById("postBgColorInput"),
  gcTitleSize: document.getElementById("gcTitleSizeInput"),
  gcSubtitleSize: document.getElementById("gcSubtitleSizeInput"),
  mainKickerSize: document.getElementById("mainKickerSizeInput"),
  mainSubtitleSize: document.getElementById("mainSubtitleSizeInput"),
  postSize: document.getElementById("postSizeInput"),
};

const styleValueLabels = {
  gcTitleSize: document.getElementById("gcTitleSizeValue"),
  gcSubtitleSize: document.getElementById("gcSubtitleSizeValue"),
  mainKickerSize: document.getElementById("mainKickerSizeValue"),
  mainSubtitleSize: document.getElementById("mainSubtitleSizeValue"),
  postSize: document.getElementById("postSizeValue"),
};

const ratioInput = document.getElementById("ratioInput");
const previewWindow = document.querySelector(".preview-window");

const visibleInputs = {
  leftTop: document.getElementById("leftTopVisibleInput"),
  leftBottom: document.getElementById("leftBottomVisibleInput"),
  main: document.getElementById("mainVisibleInput"),
  post: document.getElementById("postVisibleInput"),
  logo: document.getElementById("logoVisibleInput"),
};

function hydrateForm(state) {
  Object.entries(textInputs).forEach(([key, input]) => {
    input.value = state[key] || "";
  });
  Object.entries(styleInputs).forEach(([key, input]) => {
    input.value = state.style[key];
  });
  updateStyleValueLabels(state);
  ratioInput.value = state.layout.ratio;
  previewWindow.dataset.ratio = state.layout.ratio;
  Object.entries(visibleInputs).forEach(([key, input]) => {
    input.checked = state.layout.visible[key];
  });
}

function updateStyleValueLabels(state) {
  Object.entries(styleValueLabels).forEach(([key, label]) => {
    label.textContent = `${state.style[key]}px`;
  });
}

function updateTextState() {
  const patch = {};
  Object.entries(textInputs).forEach(([key, input]) => {
    patch[key] = input.value;
  });
  currentState = saveOverlayState({ ...currentState, ...patch });
}

function updateStyleState() {
  const style = { ...currentState.style };
  Object.entries(styleInputs).forEach(([key, input]) => {
    style[key] = input.type === "range" ? Number(input.value) : input.value;
  });
  currentState = saveOverlayState({ ...currentState, style });
  updateStyleValueLabels(currentState);
}

function updateLayoutState() {
  const visible = { ...currentState.layout.visible };
  Object.entries(visibleInputs).forEach(([key, input]) => {
    visible[key] = input.checked;
  });

  currentState = saveOverlayState({
    ...currentState,
    layout: {
      ...currentState.layout,
      ratio: ratioInput.value,
      visible,
    },
  });
  previewWindow.dataset.ratio = currentState.layout.ratio;
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
  if (event.target === ratioInput || Object.values(visibleInputs).includes(event.target)) {
    updateLayoutState();
  }
});

Object.entries(fileInputs).forEach(([key, input]) => {
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;

    input.disabled = true;
    try {
      const mediaRef = await saveOverlayMedia(key, file);

      currentState = saveOverlayState({
        ...currentState,
        images: {
          ...currentState.images,
          [key]: mediaRef,
        },
        mediaTypes: {
          ...currentState.mediaTypes,
          [key]: file.type.startsWith("video/") ? "video" : "image",
        },
      });
    } finally {
      input.disabled = false;
    }
  });
});

resetButton.addEventListener("click", async () => {
  await clearOverlayMedia();
  currentState = saveOverlayState(defaultOverlayState);
  hydrateForm(currentState);
  Object.values(fileInputs).forEach((input) => {
    input.value = "";
  });
});

hydrateForm(currentState);
