import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

type LauncherApp = {
  id: string;
  name: string;
  launchPath: string;
  launchArgs: string;
  coverPath: string;
  backgroundPath: string;
  coverSnapshotDataUrl: string;
  backgroundSnapshotDataUrl: string;
  usageSeconds: number;
};

type LaunchAppResult = {
  pid: number;
};

type ShortcutResolution = {
  targetPath: string;
  arguments: string;
};

type CoverDataUrlResult = {
  dataUrl: string;
};

type RowInfo = {
  start: number;
  count: number;
};

type NavigationTarget = "grid" | "add-button";
type ViewMode = "grid" | "carousel";
type SidebarFocusZone = "main" | "expansion";
type SidebarMenuKey = "library" | "display" | "audio" | "tools" | "power";

type AspectPreset = {
  label: string;
  ratio: number | null;
};

const STORAGE_KEY = "smarttv.apps.v1";
const VIEW_MODE_STORAGE_KEY = "smarttv.view-mode.v1";
const SOUND_VOLUME_STORAGE_KEY = "smarttv.ui-volume.v1";
const APP_TITLE_STORAGE_KEY = "smarttv.app-title.v1";
const DEFAULT_APP_TITLE = "Library";
const MAX_PER_ROW = 6;
const DEFAULT_BG_A = "#0b1f2e";
const DEFAULT_BG_B = "#162838";
const DEFAULT_SOUND_VOLUME_PERCENT = 70;

const ASPECT_PRESETS: AspectPreset[] = [
  { label: "Native", ratio: null },
  { label: "16:9", ratio: 16 / 9 },
  { label: "5:4", ratio: 5 / 4 },
  { label: "4:3", ratio: 4 / 3 }
];

type OptionAction = "launch" | "launch-options" | "rename" | "customize" | "delete";
type UiSound = "move" | "open" | "select" | "back" | "error" | "launch";

let apps: LauncherApp[] = [];
let selectedIndex = 0;

let gridEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let usageTimeEl: HTMLElement | null = null;
let appTitleEl: HTMLElement | null = null;
let settingsButtonEl: HTMLButtonElement | null = null;
let sidebarOverlayEl: HTMLElement | null = null;
let menuAddAppEl: HTMLButtonElement | null = null;
let menuBulkDeleteEl: HTMLButtonElement | null = null;
let menuExportLibraryEl: HTMLButtonElement | null = null;
let menuCustomizeTitleEl: HTMLButtonElement | null = null;
let menuViewModeEl: HTMLButtonElement | null = null;
let menuAspectEl: HTMLButtonElement | null = null;
let menuRebuildImagesEl: HTMLButtonElement | null = null;
let menuCloseEl: HTMLButtonElement | null = null;
let menuRestartSystemEl: HTMLButtonElement | null = null;
let menuShutdownSystemEl: HTMLButtonElement | null = null;
let menuVolumeSliderEl: HTMLInputElement | null = null;
let menuVolumeValueEl: HTMLElement | null = null;
let sidebarMainItems: HTMLButtonElement[] = [];
let sidebarExpansionPanels: HTMLElement[] = [];
let sidebarExpansionItems: HTMLElement[] = [];
let addDialogEl: HTMLDialogElement | null = null;
let addFormEl: HTMLFormElement | null = null;
let appNameInputEl: HTMLInputElement | null = null;
let appPathInputEl: HTMLInputElement | null = null;
let appArgsInputEl: HTMLInputElement | null = null;
let appCoverPathInputEl: HTMLInputElement | null = null;
let appBackgroundPathInputEl: HTMLInputElement | null = null;
let browsePathButtonEl: HTMLButtonElement | null = null;
let browseAppCoverPathButtonEl: HTMLButtonElement | null = null;
let browseAppBackgroundPathButtonEl: HTMLButtonElement | null = null;
let renameDialogEl: HTMLDialogElement | null = null;
let renameFormEl: HTMLFormElement | null = null;
let renameInputEl: HTMLInputElement | null = null;
let titleDialogEl: HTMLDialogElement | null = null;
let titleFormEl: HTMLFormElement | null = null;
let titleInputEl: HTMLInputElement | null = null;
let launchOptionsDialogEl: HTMLDialogElement | null = null;
let launchOptionsFormEl: HTMLFormElement | null = null;
let launchOptionsInputEl: HTMLInputElement | null = null;
let customizeCoverDialogEl: HTMLDialogElement | null = null;
let customizeCoverFormEl: HTMLFormElement | null = null;
let coverPathInputEl: HTMLInputElement | null = null;
let backgroundPathInputEl: HTMLInputElement | null = null;
let browseCoverPathButtonEl: HTMLButtonElement | null = null;
let browseBackgroundPathButtonEl: HTMLButtonElement | null = null;
let optionsDialogEl: HTMLDialogElement | null = null;
let optionsTitleEl: HTMLElement | null = null;
let optionButtons: HTMLButtonElement[] = [];
let selectedOptionIndex = 0;
let deleteConfirmDialogEl: HTMLDialogElement | null = null;
let deleteConfirmTextEl: HTMLElement | null = null;
let deleteCancelButtonEl: HTMLButtonElement | null = null;
let deleteAcceptButtonEl: HTMLButtonElement | null = null;
let bulkDeleteDialogEl: HTMLDialogElement | null = null;
let bulkDeleteListEl: HTMLElement | null = null;
let bulkSelectAllButtonEl: HTMLButtonElement | null = null;
let bulkClearSelectionButtonEl: HTMLButtonElement | null = null;
let bulkDeleteSelectedButtonEl: HTMLButtonElement | null = null;
let bulkDeleteCancelButtonEl: HTMLButtonElement | null = null;
let clearCoverButtonEl: HTMLButtonElement | null = null;
let clearBackgroundButtonEl: HTMLButtonElement | null = null;
let appShellEl: HTMLElement | null = null;
let appBackgroundLayerAEl: HTMLElement | null = null;
let appBackgroundLayerBEl: HTMLElement | null = null;
let viewModeDialogEl: HTMLDialogElement | null = null;
let viewModeGridButtonEl: HTMLButtonElement | null = null;
let viewModeCarouselButtonEl: HTMLButtonElement | null = null;
let viewModeCancelButtonEl: HTMLButtonElement | null = null;
let selectedConfirmIndex = 0;
let selectedViewModeIndex = 0;
let bulkDeleteCursorIndex = 0;
const bulkDeleteSelectedAppIds = new Set<string>();

let cards: HTMLElement[] = [];
let carouselTrackEl: HTMLElement | null = null;
let rowLayout: RowInfo[] = [];
const coverDataUrlCache = new Map<string, string>();
const coverGradientCache = new Map<string, [string, string]>();
let navigationTarget: NavigationTarget = "grid";
let viewMode: ViewMode = "grid";
let carouselAnimationFrameId: number | null = null;
let currentCarouselOffset = 0;
let backgroundRequestToken = 0;
let aspectPresetIndex = 0;
let activeBackgroundLayerIndex = 0;
let backgroundCleanupTimerId: number | null = null;
let selectedSidebarMainIndex = 0;
let selectedSidebarExpansionIndex = 0;
let sidebarFocusZone: SidebarFocusZone = "main";
let activeSidebarMenuKey: SidebarMenuKey | null = null;
let sidebarVolumeControlLocked = false;

let previousActionPressed = false;
let previousBackPressed = false;
let previousStartPressed = false;
let nextMoveAt = 0;
let lastDirection = "0,0";
let lastKeyboardMoveAt = 0;
let titleRevealTimerId: number | null = null;
let audioContext: AudioContext | null = null;
let audioMasterGain: GainNode | null = null;
let uiVolumePercent = DEFAULT_SOUND_VOLUME_PERCENT;
let lastMoveSoundAt = 0;
let fastNavigationUntil = 0;
let activeUsageAppId: string | null = null;
let activeUsagePid: number | null = null;
let activeUsageStartedAtMs = 0;
let usagePollTimerId: number | null = null;

const MOVE_SOUND_COOLDOWN_MS = 260;
const FAST_NAV_WINDOW_MS = 200;
const SIDEBAR_MENU_ORDER: SidebarMenuKey[] = ["library", "display", "audio", "tools", "power"];

function markFastNavigationWindow(): void {
  fastNavigationUntil = performance.now() + FAST_NAV_WINDOW_MS;
}

function isFastNavigationActive(): boolean {
  return performance.now() < fastNavigationUntil;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadUiVolumePercent(): number {
  const raw = localStorage.getItem(SOUND_VOLUME_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SOUND_VOLUME_PERCENT;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SOUND_VOLUME_PERCENT;
  }

  return clamp(parsed, 0, 100);
}

function saveUiVolumePercent(): void {
  localStorage.setItem(SOUND_VOLUME_STORAGE_KEY, String(uiVolumePercent));
}

function getMasterGainValue(): number {
  const normalized = uiVolumePercent / 100;
  if (normalized <= 0) {
    return 0;
  }

  // Keep low volume usable while allowing stronger output at higher settings.
  const curved = Math.pow(normalized, 0.92);
  return Math.min(0.34, Math.max(0.035, 0.34 * curved));
}

function refreshVolumeLabel(): void {
  if (menuVolumeValueEl) {
    menuVolumeValueEl.textContent = `${uiVolumePercent}%`;
  }

  if (menuVolumeSliderEl && Number.parseInt(menuVolumeSliderEl.value, 10) !== uiVolumePercent) {
    menuVolumeSliderEl.value = String(uiVolumePercent);
  }
}

function applyUiVolumePercent(value: number, shouldSave = true): void {
  uiVolumePercent = clamp(Math.round(value), 0, 100);
  refreshVolumeLabel();

  if (audioMasterGain) {
    audioMasterGain.gain.value = getMasterGainValue();
  }

  if (shouldSave) {
    saveUiVolumePercent();
  }
}

function nudgeUiVolume(delta: number): boolean {
  const previous = uiVolumePercent;
  applyUiVolumePercent(uiVolumePercent + delta);
  return uiVolumePercent !== previous;
}

function getSelectedSidebarMainItem(): HTMLButtonElement | null {
  return sidebarMainItems[selectedSidebarMainIndex] ?? null;
}

function getSelectedSidebarExpansionItem(): HTMLElement | null {
  return sidebarExpansionItems[selectedSidebarExpansionIndex] ?? null;
}

function toSidebarMenuKey(value: string | undefined): SidebarMenuKey {
  return SIDEBAR_MENU_ORDER.includes(value as SidebarMenuKey) ? (value as SidebarMenuKey) : "library";
}

function refreshActiveSidebarExpansionItems(): void {
  const activePanel = sidebarExpansionPanels.find((panel) => panel.classList.contains("is-active")) ?? null;
  sidebarExpansionItems = activePanel
    ? Array.from(activePanel.querySelectorAll<HTMLElement>(".sidebar-expansion-item"))
    : [];

  if (sidebarExpansionItems.length === 0) {
    selectedSidebarExpansionIndex = 0;
    return;
  }

  selectedSidebarExpansionIndex = Math.max(0, Math.min(selectedSidebarExpansionIndex, sidebarExpansionItems.length - 1));
}

function setActiveSidebarMenu(key: SidebarMenuKey | null): void {
  if (activeSidebarMenuKey !== key || key === null) {
    setSidebarVolumeControlLocked(false);
  }
  activeSidebarMenuKey = key;

  sidebarExpansionPanels.forEach((panel) => {
    panel.classList.toggle("is-active", key !== null && panel.dataset.expansionPanel === key);
  });

  refreshActiveSidebarExpansionItems();
}

function isVolumeSliderSelected(): boolean {
  const selected = getSelectedSidebarExpansionItem();
  return selected === menuVolumeSliderEl;
}

function setSidebarVolumeControlLocked(locked: boolean): void {
  sidebarVolumeControlLocked = locked;
  menuVolumeSliderEl?.classList.toggle("is-locked", locked);
  if (statusEl && isVolumeSliderSelected()) {
    statusEl.textContent = locked ? `UI volume locked. Use Left/Right to adjust (${uiVolumePercent}%).` : "UI volume unlocked.";
  }
}

function getAudioContextCtor(): typeof AudioContext | null {
  const ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return ctor ?? null;
}

function getOrCreateAudioContext(): AudioContext | null {
  if (audioContext && audioMasterGain) {
    return audioContext;
  }

  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    return null;
  }

  try {
    audioContext = new AudioContextCtor();
    audioMasterGain = audioContext.createGain();
    audioMasterGain.gain.value = getMasterGainValue();
    audioMasterGain.connect(audioContext.destination);
    return audioContext;
  } catch {
    audioContext = null;
    audioMasterGain = null;
    return null;
  }
}

function scheduleTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  endFrequency?: number
): void {
  if (!audioMasterGain) {
    return;
  }

  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  if (typeof endFrequency === "number") {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startTime + duration);
  }

  envelope.gain.setValueAtTime(0.0001, startTime);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), startTime + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(envelope);
  envelope.connect(audioMasterGain);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function playUiSound(sound: UiSound): void {
  if (sound === "move") {
    const nowMs = performance.now();
    if (nowMs - lastMoveSoundAt < MOVE_SOUND_COOLDOWN_MS) {
      return;
    }
    lastMoveSoundAt = nowMs;
  }

  const ctx = getOrCreateAudioContext();
  if (!ctx || !audioMasterGain) {
    return;
  }

  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  const now = ctx.currentTime + 0.001;

  switch (sound) {
    case "move":
      scheduleTone(ctx, 420, now, 0.075, "square", 0.14, 360);
      scheduleTone(ctx, 300, now + 0.028, 0.06, "triangle", 0.11, 250);
      break;
    case "open":
      scheduleTone(ctx, 420, now, 0.07, "sine", 0.11, 520);
      scheduleTone(ctx, 650, now + 0.025, 0.08, "triangle", 0.1, 780);
      break;
    case "select":
      scheduleTone(ctx, 700, now, 0.075, "square", 0.12, 860);
      scheduleTone(ctx, 920, now + 0.034, 0.095, "triangle", 0.12, 1120);
      break;
    case "back":
      scheduleTone(ctx, 660, now, 0.07, "triangle", 0.1, 520);
      scheduleTone(ctx, 460, now + 0.04, 0.09, "sine", 0.1, 360);
      break;
    case "error":
      scheduleTone(ctx, 260, now, 0.11, "sawtooth", 0.1, 190);
      scheduleTone(ctx, 180, now + 0.055, 0.14, "sawtooth", 0.09, 130);
      break;
    case "launch":
      scheduleTone(ctx, 520, now, 0.075, "triangle", 0.12, 760);
      scheduleTone(ctx, 860, now + 0.03, 0.09, "square", 0.1, 1160);
      scheduleTone(ctx, 1280, now + 0.072, 0.1, "triangle", 0.08, 1520);
      break;
    default:
      break;
  }
}

function normalizeDialogPath(selected: unknown): string {
  let rawPath = "";

  if (typeof selected === "string") {
    rawPath = selected;
  } else if (Array.isArray(selected) && typeof selected[0] === "string") {
    rawPath = selected[0];
  } else if (selected && typeof selected === "object" && "path" in selected) {
    const maybePath = (selected as { path?: unknown }).path;
    if (typeof maybePath === "string") {
      rawPath = maybePath;
    }
  }

  if (!rawPath) {
    return "";
  }

  let normalized = rawPath;
  if (normalized.startsWith("file://")) {
    normalized = decodeURIComponent(normalized.replace("file://", ""));
    if (/^\/[A-Za-z]:\//.test(normalized)) {
      normalized = normalized.slice(1);
    }
  }

  if (/^[A-Za-z]:\//.test(normalized)) {
    normalized = normalized.replace(/\//g, "\\");
  }

  return normalized;
}

function inferNameFromPath(path: string): string {
  const fileName = path.split(/[\\/]/).pop() ?? "";
  return fileName.replace(/\.(exe|lnk|bat|cmd|url)$/i, "").trim();
}

function isShortcutPath(path: string): boolean {
  return /\.lnk$/i.test(path.trim());
}

function formatUsageDuration(secondsRaw: number): string {
  const totalSeconds = Math.max(0, Math.floor(secondsRaw));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function updateUsageTimeDisplay(): void {
  if (!usageTimeEl) {
    return;
  }

  const app = getSelectedApp();
  if (!app) {
    usageTimeEl.textContent = "Usage Time: 0m";
    return;
  }

  let total = app.usageSeconds;
  if (activeUsageAppId === app.id && activeUsageStartedAtMs > 0) {
    total += Math.floor((Date.now() - activeUsageStartedAtMs) / 1000);
  }

  usageTimeEl.textContent = `Usage Time: ${formatUsageDuration(total)}`;
}

function clearUsagePollTimer(): void {
  if (usagePollTimerId !== null) {
    clearInterval(usagePollTimerId);
    usagePollTimerId = null;
  }
}

async function finalizeActiveUsageSession(): Promise<void> {
  if (!activeUsageAppId || activeUsageStartedAtMs <= 0) {
    clearUsagePollTimer();
    activeUsageAppId = null;
    activeUsagePid = null;
    activeUsageStartedAtMs = 0;
    updateUsageTimeDisplay();
    return;
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - activeUsageStartedAtMs) / 1000));
  const app = apps.find((candidate) => candidate.id === activeUsageAppId);
  if (app && elapsedSeconds > 0) {
    app.usageSeconds += elapsedSeconds;
    saveApps();
  }

  clearUsagePollTimer();
  activeUsageAppId = null;
  activeUsagePid = null;
  activeUsageStartedAtMs = 0;
  updateUsageTimeDisplay();
}

async function pollActiveUsageProcess(): Promise<void> {
  if (!activeUsageAppId || !activeUsagePid) {
    return;
  }

  try {
    const running = await invoke<boolean>("is_process_running", { pid: activeUsagePid });
    if (!running) {
      await finalizeActiveUsageSession();
    } else {
      updateUsageTimeDisplay();
    }
  } catch {
    // If process checks fail, keep session until next successful check or app restart.
  }
}

function startUsageSession(appId: string, pid: number): void {
  void finalizeActiveUsageSession();

  activeUsageAppId = appId;
  activeUsagePid = pid;
  activeUsageStartedAtMs = Date.now();

  clearUsagePollTimer();
  usagePollTimerId = window.setInterval(() => {
    void pollActiveUsageProcess();
  }, 1500);

  updateUsageTimeDisplay();
}

function loadApps(): LauncherApp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Array<Partial<LauncherApp>>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item.id && item.name && item.launchPath)
      .map((item) => ({
        id: item.id as string,
        name: item.name as string,
        launchPath: item.launchPath as string,
        launchArgs: typeof item.launchArgs === "string" ? item.launchArgs : "",
        coverPath: typeof item.coverPath === "string" ? item.coverPath : "",
        backgroundPath: typeof item.backgroundPath === "string" ? item.backgroundPath : "",
        coverSnapshotDataUrl: typeof item.coverSnapshotDataUrl === "string" ? item.coverSnapshotDataUrl : "",
        backgroundSnapshotDataUrl:
          typeof item.backgroundSnapshotDataUrl === "string" ? item.backgroundSnapshotDataUrl : "",
        usageSeconds: typeof item.usageSeconds === "number" && Number.isFinite(item.usageSeconds)
          ? Math.max(0, Math.floor(item.usageSeconds))
          : 0
      }));
  } catch {
    return [];
  }
}

function saveApps(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

function loadViewMode(): ViewMode {
  const raw = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return raw === "carousel" ? "carousel" : "grid";
}

function loadAppTitle(): string {
  const raw = localStorage.getItem(APP_TITLE_STORAGE_KEY);
  const normalized = raw?.trim() ?? "";
  return normalized || DEFAULT_APP_TITLE;
}

function saveViewMode(): void {
  localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
}

function saveAppTitle(title: string): void {
  localStorage.setItem(APP_TITLE_STORAGE_KEY, title);
}

function applyAppTitle(title: string, shouldSave = true): void {
  const normalized = title.trim() || DEFAULT_APP_TITLE;
  if (appTitleEl) {
    appTitleEl.textContent = normalized;
  }

  if (shouldSave) {
    saveAppTitle(normalized);
  }
}

function buildBalancedRows(total: number): RowInfo[] {
  if (total <= 0) {
    return [];
  }

  const rows = Math.ceil(total / MAX_PER_ROW);
  const base = Math.floor(total / rows);
  const remainder = total % rows;

  const result: RowInfo[] = [];
  let start = 0;

  for (let row = 0; row < rows; row += 1) {
    const count = base + (row < remainder ? 1 : 0);
    result.push({ start, count });
    start += count;
  }

  return result;
}

function getCarouselOrderedApps(): LauncherApp[] {
  if (apps.length === 0) {
    return [];
  }

  const anchorStart = (selectedIndex - 1 + apps.length) % apps.length;
  return [...apps.slice(anchorStart), ...apps.slice(0, anchorStart)];
}

function stopCarouselAnimation(): void {
  if (carouselAnimationFrameId !== null) {
    cancelAnimationFrame(carouselAnimationFrameId);
    carouselAnimationFrameId = null;
  }
}

function getCarouselStepDistance(): number {
  if (!carouselTrackEl) {
    return 0;
  }

  const firstCard = carouselTrackEl.querySelector<HTMLElement>(".cover-card");
  if (!firstCard) {
    return 0;
  }

  const trackStyle = window.getComputedStyle(carouselTrackEl);
  const gapRaw = trackStyle.columnGap || trackStyle.gap || "0";
  const gap = Number.parseFloat(gapRaw) || 0;
  const cardWidth = firstCard.getBoundingClientRect().width;
  return cardWidth + gap;
}

function startCarouselCatchupAnimation(): void {
  if (carouselAnimationFrameId !== null) {
    return;
  }

  const tick = () => {
    if (!carouselTrackEl) {
      carouselAnimationFrameId = null;
      return;
    }

    const delta = 0 - currentCarouselOffset;
    currentCarouselOffset += delta * 0.26;

    if (Math.abs(delta) < 0.5) {
      currentCarouselOffset = 0;
      carouselTrackEl.style.transform = "translate3d(0, 0, 0)";
      carouselAnimationFrameId = null;
      return;
    }

    carouselTrackEl.style.transform = `translate3d(${currentCarouselOffset}px, 0, 0)`;
    carouselAnimationFrameId = requestAnimationFrame(tick);
  };

  carouselAnimationFrameId = requestAnimationFrame(tick);
}

function colorFromName(name: string): [string, string] {
  let hash = 0;
  for (const character of name) {
    hash = (hash << 5) - hash + character.charCodeAt(0);
    hash |= 0;
  }

  const hueA = Math.abs(hash) % 360;
  const hueB = (hueA + 38) % 360;
  return [`hsl(${hueA} 62% 33%)`, `hsl(${hueB} 74% 57%)`];
}

async function getImageDataUrl(path: string): Promise<string> {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    throw new Error("Image path is empty");
  }

  const cached = coverDataUrlCache.get(normalizedPath);
  if (cached) {
    return cached;
  }

  const loaded = await invoke<CoverDataUrlResult>("load_cover_data_url", { path: normalizedPath });
  coverDataUrlCache.set(normalizedPath, loaded.dataUrl);
  return loaded.dataUrl;
}

function isDataUrl(value: string): boolean {
  return /^data:image\/.+;base64,/i.test(value.trim());
}

async function loadImageDataWithFallback(
  path: string,
  snapshotDataUrl: string
): Promise<{ dataUrl: string; source: "path" | "snapshot" }> {
  const normalizedPath = path.trim();
  if (normalizedPath) {
    try {
      const dataUrl = await getImageDataUrl(normalizedPath);
      return { dataUrl, source: "path" };
    } catch {
      // Continue to snapshot fallback if source file is missing.
    }
  }

  const snapshot = snapshotDataUrl.trim();
  if (isDataUrl(snapshot)) {
    return { dataUrl: snapshot, source: "snapshot" };
  }

  throw new Error("no valid source image or snapshot available");
}

async function buildSnapshotDataUrl(
  sourceDataUrl: string,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<string> {
  const image = await decodeImageFromDataUrl(sourceDataUrl);
  const scale = Math.min(maxWidth / Math.max(1, image.width), maxHeight / Math.max(1, image.height), 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas context unavailable for snapshot");
  }

  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function ensureAppSnapshot(
  app: LauncherApp,
  kind: "cover" | "background",
  source: "path" | "snapshot",
  sourceDataUrl: string
): Promise<void> {
  if (source !== "path") {
    return;
  }

  if (kind === "cover" && app.coverSnapshotDataUrl.trim()) {
    return;
  }
  if (kind === "background" && app.backgroundSnapshotDataUrl.trim()) {
    return;
  }

  try {
    const snapshot =
      kind === "cover"
        ? await buildSnapshotDataUrl(sourceDataUrl, 240, 360, 0.82)
        : await buildSnapshotDataUrl(sourceDataUrl, 640, 360, 0.78);

    if (kind === "cover") {
      app.coverSnapshotDataUrl = snapshot;
    } else {
      app.backgroundSnapshotDataUrl = snapshot;
    }

    saveApps();
  } catch (error) {
    console.warn(`failed to persist ${kind} snapshot`, error);
  }
}

function toRgbCss(r: number, g: number, b: number): string {
  return `rgb(${Math.max(0, Math.min(255, r))} ${Math.max(0, Math.min(255, g))} ${Math.max(0, Math.min(255, b))})`;
}

function setShellGradient(colorA: string, colorB: string): void {
  if (!appShellEl) {
    return;
  }
  appShellEl.style.setProperty("--bg-a", colorA);
  appShellEl.style.setProperty("--bg-b", colorB);
}

function clearBackgroundCleanupTimer(): void {
  if (backgroundCleanupTimerId !== null) {
    clearTimeout(backgroundCleanupTimerId);
    backgroundCleanupTimerId = null;
  }
}

function getBackgroundLayers(): [HTMLElement | null, HTMLElement | null] {
  return [appBackgroundLayerAEl, appBackgroundLayerBEl];
}

function setBackgroundImageWithTransition(dataUrl: string): void {
  const [layerA, layerB] = getBackgroundLayers();
  if (!layerA || !layerB) {
    return;
  }

  clearBackgroundCleanupTimer();

  const outgoing = activeBackgroundLayerIndex === 0 ? layerA : layerB;
  const incoming = activeBackgroundLayerIndex === 0 ? layerB : layerA;

  incoming.style.backgroundImage = `url("${dataUrl}")`;
  incoming.classList.add("is-visible");
  outgoing.classList.remove("is-visible");

  activeBackgroundLayerIndex = activeBackgroundLayerIndex === 0 ? 1 : 0;
  appShellEl?.classList.add("has-custom-background");

  backgroundCleanupTimerId = window.setTimeout(() => {
    outgoing.style.backgroundImage = "none";
    backgroundCleanupTimerId = null;
  }, 420);
}

function clearBackgroundImageWithTransition(): void {
  const [layerA, layerB] = getBackgroundLayers();
  if (!layerA || !layerB) {
    return;
  }

  clearBackgroundCleanupTimer();
  layerA.classList.remove("is-visible");
  layerB.classList.remove("is-visible");
  appShellEl?.classList.remove("has-custom-background");

  backgroundCleanupTimerId = window.setTimeout(() => {
    layerA.style.backgroundImage = "none";
    layerB.style.backgroundImage = "none";
    backgroundCleanupTimerId = null;
  }, 420);
}

function resetBackgroundVisuals(): void {
  clearBackgroundCleanupTimer();
  setShellGradient(DEFAULT_BG_A, DEFAULT_BG_B);
  appShellEl?.classList.remove("has-custom-background");
  appBackgroundLayerAEl?.classList.remove("is-visible");
  appBackgroundLayerBEl?.classList.remove("is-visible");
  if (appBackgroundLayerAEl) {
    appBackgroundLayerAEl.style.backgroundImage = "none";
  }
  if (appBackgroundLayerBEl) {
    appBackgroundLayerBEl.style.backgroundImage = "none";
  }
}

async function decodeImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = dataUrl;
  });

  return image;
}

function isCloseRatio(actual: number, target: number): boolean {
  return Math.abs(actual - target) <= 0.05;
}

async function validateBackgroundAspect(path: string): Promise<boolean> {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return true;
  }

  try {
    const dataUrl = await getImageDataUrl(normalizedPath);
    const image = await decodeImageFromDataUrl(dataUrl);
    const ratio = image.width / Math.max(1, image.height);

    if (isCloseRatio(ratio, 16 / 9) || isCloseRatio(ratio, 5 / 4)) {
      return true;
    }

    if (statusEl) {
      statusEl.textContent = "Background image must be close to 16:9 or 5:4.";
    }
    return false;
  } catch (error) {
    console.warn("background aspect validation failed", error);
    if (statusEl) {
      statusEl.textContent = "Could not read background image dimensions.";
    }
    return false;
  }
}

async function extractDominantGradientFromDataUrl(dataUrl: string): Promise<[string, string]> {
  const image = await decodeImageFromDataUrl(dataUrl);

  const sampleW = 20;
  const sampleH = 12;
  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Canvas context not available");
  }

  ctx.drawImage(image, 0, 0, sampleW, sampleH);
  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
  const counts = new Map<string, number>();

  // Sample every other pixel with quantization to keep CPU cost low.
  for (let i = 0; i < data.length; i += 8) {
    const alpha = data[i + 3];
    if (alpha < 40) {
      continue;
    }

    const r = data[i] & 224;
    const g = data[i + 1] & 224;
    const b = data[i + 2] & 224;
    const key = `${r},${g},${b}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return [DEFAULT_BG_A, DEFAULT_BG_B];
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const parseRgb = (key: string): [number, number, number] => {
    const parts = key.split(",").map((part) => Number.parseInt(part, 10));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };

  const [pR, pG, pB] = parseRgb(ranked[0][0]);
  let secondary = ranked[1]?.[0] ?? ranked[0][0];

  for (let i = 1; i < ranked.length; i += 1) {
    const [r, g, b] = parseRgb(ranked[i][0]);
    const distance = Math.abs(r - pR) + Math.abs(g - pG) + Math.abs(b - pB);
    if (distance >= 72) {
      secondary = ranked[i][0];
      break;
    }
  }

  const [sR, sG, sB] = parseRgb(secondary);
  const primaryColor = toRgbCss(pR, pG, pB);
  const secondaryColor = toRgbCss(Math.round(sR * 0.82), Math.round(sG * 0.82), Math.round(sB * 0.82));

  return [primaryColor, secondaryColor];
}

async function getCoverGradient(path: string): Promise<[string, string]> {
  const normalizedPath = path.trim();
  const cached = coverGradientCache.get(normalizedPath);
  if (cached) {
    return cached;
  }

  const dataUrl = await getImageDataUrl(normalizedPath);
  const colors = await extractDominantGradientFromDataUrl(dataUrl);
  coverGradientCache.set(normalizedPath, colors);
  return colors;
}

async function applyFocusedBackground(): Promise<void> {
  const requestToken = ++backgroundRequestToken;
  const app = getSelectedApp();

  if (!app) {
    resetBackgroundVisuals();
    return;
  }

  if (app.backgroundPath.trim() || app.backgroundSnapshotDataUrl.trim()) {
    try {
      const { dataUrl, source } = await loadImageDataWithFallback(app.backgroundPath, app.backgroundSnapshotDataUrl);
      if (requestToken !== backgroundRequestToken) {
        return;
      }

      void ensureAppSnapshot(app, "background", source, dataUrl);
      setBackgroundImageWithTransition(dataUrl);

      if (source === "snapshot" && statusEl) {
        statusEl.textContent = `Focused: ${app.name} (using cached background snapshot)`;
      }
      return;
    } catch (error) {
      if (requestToken !== backgroundRequestToken) {
        return;
      }
      console.warn("background image load failed", error);
      if (statusEl) {
        statusEl.textContent = `Background image failed to load for ${app.name}. Using gradient fallback.`;
      }
    }
  }

  if (requestToken !== backgroundRequestToken) {
    return;
  }

  clearBackgroundImageWithTransition();

  if (app.coverPath.trim() || app.coverSnapshotDataUrl.trim()) {
    try {
      const coverSource = await loadImageDataWithFallback(app.coverPath, app.coverSnapshotDataUrl);
      const [a, b] =
        coverSource.source === "path"
          ? await getCoverGradient(app.coverPath)
          : await extractDominantGradientFromDataUrl(coverSource.dataUrl);
      if (requestToken !== backgroundRequestToken) {
        return;
      }
      setShellGradient(a, b);
      return;
    } catch (error) {
      if (requestToken !== backgroundRequestToken) {
        return;
      }
      console.warn("cover gradient extraction failed", error);
    }
  }

  if (requestToken !== backgroundRequestToken) {
    return;
  }

  const [a, b] = colorFromName(app.name);
  setShellGradient(a, b);
}

function applyAspectPreset(): void {
  const preset = ASPECT_PRESETS[aspectPresetIndex] ?? ASPECT_PRESETS[0];
  if (menuAspectEl) {
    menuAspectEl.textContent = `Aspect: ${preset.label}`;
  }

  if (preset.ratio === null) {
    document.body.classList.remove("debug-aspect");
    document.body.style.removeProperty("--debug-aspect");
    return;
  }

  document.body.classList.add("debug-aspect");
  document.body.style.setProperty("--debug-aspect", String(preset.ratio));
}

function cycleAspectPreset(): void {
  aspectPresetIndex = (aspectPresetIndex + 1) % ASPECT_PRESETS.length;
  applyAspectPreset();
  if (statusEl) {
    statusEl.textContent = `Aspect debug: ${ASPECT_PRESETS[aspectPresetIndex].label}`;
  }
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "APP";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 3).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

async function applyCoverImage(card: HTMLElement, app: LauncherApp): Promise<void> {
  if (!app.coverPath.trim() && !app.coverSnapshotDataUrl.trim()) {
    return;
  }

  try {
    const { dataUrl, source } = await loadImageDataWithFallback(app.coverPath, app.coverSnapshotDataUrl);

    void ensureAppSnapshot(app, "cover", source, dataUrl);

    if (card.dataset.id === app.id) {
      card.classList.add("has-cover");
      card.style.setProperty("--cover-image", `url("${dataUrl}")`);
    }
  } catch (error) {
    card.classList.remove("has-cover");
    card.style.removeProperty("--cover-image");
    console.warn("cover load failed", error);
  }
}

function renderGrid(): void {
  if (!gridEl) {
    return;
  }

  gridEl.innerHTML = "";
  carouselTrackEl = null;
  rowLayout = [];

  if (apps.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<h2>No apps yet</h2><p>Press A or use Add App to create your first launcher tile.</p>`;
    gridEl.append(empty);
    cards = [];
    if (statusEl) {
      statusEl.textContent = "No apps yet. Press A to add one.";
    }
    resetBackgroundVisuals();
    setNavigationTarget("add-button");
    return;
  }

  if (viewMode === "carousel") {
    const track = document.createElement("div");
    track.className = "carousel-track";

    for (const app of getCarouselOrderedApps()) {
      const [colorA, colorB] = colorFromName(app.name);
      const card = document.createElement("article");
      card.className = "cover-card";
      card.tabIndex = -1;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", app.name);
      card.style.setProperty("--cover-a", colorA);
      card.style.setProperty("--cover-b", colorB);
      card.dataset.id = app.id;

      if (app.coverPath.trim() || app.coverSnapshotDataUrl.trim()) {
        void applyCoverImage(card, app);
      }

      const initials = document.createElement("span");
      initials.className = "cover-initials";
      initials.textContent = initialsFromName(app.name);

      const title = document.createElement("h2");
      title.textContent = app.name;

      card.append(initials, title);
      track.append(card);
    }

    if (currentCarouselOffset !== 0) {
      track.style.transform = `translate3d(${currentCarouselOffset}px, 0, 0)`;
    }

    gridEl.append(track);
    carouselTrackEl = track;
  } else {
    rowLayout = buildBalancedRows(apps.length);

    for (const row of rowLayout) {
      const rowEl = document.createElement("div");
      rowEl.className = "grid-row";
      rowEl.style.setProperty("--row-count", String(row.count));

      const rowItems = apps.slice(row.start, row.start + row.count);
      for (const app of rowItems) {
        const [colorA, colorB] = colorFromName(app.name);
        const card = document.createElement("article");
        card.className = "cover-card";
        card.tabIndex = -1;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", app.name);
        card.style.setProperty("--cover-a", colorA);
        card.style.setProperty("--cover-b", colorB);
        card.dataset.id = app.id;

        if (app.coverPath.trim() || app.coverSnapshotDataUrl.trim()) {
          void applyCoverImage(card, app);
        }

        const initials = document.createElement("span");
        initials.className = "cover-initials";
        initials.textContent = initialsFromName(app.name);

        const title = document.createElement("h2");
        title.textContent = app.name;

        card.append(initials, title);
        rowEl.append(card);
      }

      gridEl.append(rowEl);
    }
  }

  cards = Array.from(gridEl.querySelectorAll(".cover-card"));
  selectedIndex = Math.min(selectedIndex, cards.length - 1);
  setNavigationTarget("grid");
  applySelection();
}

function getSelectedApp(): LauncherApp | null {
  if (apps.length === 0 || selectedIndex < 0 || selectedIndex >= apps.length) {
    return null;
  }
  return apps[selectedIndex];
}

function getRowAndColumn(index: number): { row: number; col: number } {
  for (let i = 0; i < rowLayout.length; i += 1) {
    const row = rowLayout[i];
    if (index >= row.start && index < row.start + row.count) {
      return { row: i, col: index - row.start };
    }
  }
  return { row: 0, col: 0 };
}

function moveVerticalGrid(direction: -1 | 1): void {
  if (apps.length === 0 || rowLayout.length === 0) {
    return;
  }

  const current = getRowAndColumn(selectedIndex);
  const targetRowIndex = current.row + direction;
  if (targetRowIndex < 0 || targetRowIndex >= rowLayout.length) {
    return;
  }

  const currentRow = rowLayout[current.row];
  const targetRow = rowLayout[targetRowIndex];

  const ratio = currentRow.count === 1 ? 0.5 : current.col / (currentRow.count - 1);
  const targetCol = targetRow.count === 1 ? 0 : Math.round(ratio * (targetRow.count - 1));
  selectedIndex = targetRow.start + targetCol;
}

function moveSelection(deltaX: number, deltaY: number): void {
  if (apps.length === 0) {
    return;
  }

  const previousIndex = selectedIndex;
  const fastNavigation = isFastNavigationActive();

  if (viewMode === "carousel") {
    if (deltaX === 0) {
      return;
    }

    const distance = getCarouselStepDistance();
    currentCarouselOffset += deltaX > 0 ? distance : -distance;
    selectedIndex = (selectedIndex + deltaX + apps.length) % apps.length;

    if (carouselTrackEl) {
      const steps = Math.abs(deltaX);
      for (let i = 0; i < steps; i++) {
        if (deltaX > 0) {
          const first = carouselTrackEl.firstElementChild;
          if (first) carouselTrackEl.appendChild(first);
        } else {
          const last = carouselTrackEl.lastElementChild;
          if (last) carouselTrackEl.insertBefore(last, carouselTrackEl.firstElementChild);
        }
      }
      if (gridEl) {
        cards = Array.from(gridEl.querySelectorAll(".cover-card"));
      }
    }

    applySelection();
    if (fastNavigation) {
      stopCarouselAnimation();
      currentCarouselOffset = 0;
      if (carouselTrackEl) {
        carouselTrackEl.style.transform = "translate3d(0, 0, 0)";
      }
    } else {
      startCarouselCatchupAnimation();
    }
    if (selectedIndex !== previousIndex) {
      playUiSound("move");
    }
    return;
  }

  if (deltaY !== 0) {
    moveVerticalGrid(deltaY > 0 ? 1 : -1);
    applySelection();
    if (selectedIndex !== previousIndex) {
      playUiSound("move");
    }
    return;
  }

  const current = getRowAndColumn(selectedIndex);
  const row = rowLayout[current.row];
  const nextCol = current.col + deltaX;
  if (nextCol < 0 || nextCol >= row.count) {
    return;
  }

  selectedIndex = row.start + nextCol;
  applySelection();
  if (selectedIndex !== previousIndex) {
    playUiSound("move");
  }
}

function setNavigationTarget(target: NavigationTarget): void {
  const changed = navigationTarget !== target;
  navigationTarget = target;
  settingsButtonEl?.classList.toggle("nav-selected", target === "add-button");
  appShellEl?.classList.toggle("settings-focus", target === "add-button");

  if (target === "add-button") {
    // Cancel any in-flight app background request and show neutral settings backdrop.
    backgroundRequestToken += 1;
    clearBackgroundImageWithTransition();
    setShellGradient(DEFAULT_BG_A, DEFAULT_BG_B);

    if (statusEl) {
      statusEl.textContent = "Focused: Menu";
    }

    // Remove tile highlight while Menu owns focus.
    cards.forEach((card) => {
      card.classList.remove("selected");
      card.classList.remove("show-title");
    });
  }

  if (changed) {
    playUiSound("move");
  }
}

function setViewMode(nextMode: ViewMode): void {
  viewMode = nextMode;
  saveViewMode();
  currentCarouselOffset = 0;
  stopCarouselAnimation();

  if (gridEl) {
    gridEl.classList.toggle("view-grid", viewMode === "grid");
    gridEl.classList.toggle("view-carousel", viewMode === "carousel");
  }

  renderGrid();
}

function focusWithoutScroll(element: HTMLElement | null): void {
  if (!element) {
    return;
  }

  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function openSettingsSidebar(): void {
  const wasOpen = appShellEl?.classList.contains("sidebar-open") ?? false;
  appShellEl?.classList.add("sidebar-open");
  if (appShellEl) {
    appShellEl.scrollLeft = 0;
  }
  if (gridEl) {
    gridEl.scrollLeft = 0;
  }
  selectedSidebarMainIndex = 0;
  selectedSidebarExpansionIndex = 0;
  sidebarFocusZone = "main";
  setActiveSidebarMenu(null);
  applySidebarSelection();
  if (statusEl) {
    statusEl.textContent = "Menu open.";
  }

  if (!wasOpen) {
    playUiSound("open");
  }
}

function closeSettingsSidebar(): void {
  const wasOpen = appShellEl?.classList.contains("sidebar-open") ?? false;
  appShellEl?.classList.remove("sidebar-open");
  setSidebarVolumeControlLocked(false);
  if (appShellEl) {
    appShellEl.scrollLeft = 0;
  }
  if (gridEl) {
    gridEl.scrollLeft = 0;
  }
  sidebarMainItems.forEach((item) => item.classList.remove("sidebar-selected"));
  sidebarExpansionItems.forEach((item) => item.classList.remove("sidebar-selected"));

  if (wasOpen) {
    playUiSound("back");
  }
}

function toggleSettingsSidebar(): void {
  if (appShellEl?.classList.contains("sidebar-open")) {
    closeSettingsSidebar();
  } else {
    openSettingsSidebar();
  }
}

function applySidebarSelection(): void {
  if (sidebarMainItems.length === 0) {
    return;
  }

  selectedSidebarMainIndex = Math.max(0, Math.min(selectedSidebarMainIndex, sidebarMainItems.length - 1));
  refreshActiveSidebarExpansionItems();

  sidebarMainItems.forEach((item, index) => {
    item.classList.toggle("sidebar-selected", index === selectedSidebarMainIndex);
  });

  sidebarExpansionItems.forEach((item, index) => {
    item.classList.toggle("sidebar-selected", index === selectedSidebarExpansionIndex);
  });

  if (sidebarFocusZone === "main") {
    focusWithoutScroll(getSelectedSidebarMainItem());
  } else {
    if (sidebarExpansionItems.length === 0) {
      sidebarFocusZone = "main";
      focusWithoutScroll(getSelectedSidebarMainItem());
      return;
    }
    focusWithoutScroll(getSelectedSidebarExpansionItem());
  }
}

function moveSidebarSelection(delta: number): void {
  if (sidebarFocusZone === "main") {
    if (sidebarMainItems.length === 0) {
      return;
    }

    const previousIndex = selectedSidebarMainIndex;
    selectedSidebarMainIndex = (selectedSidebarMainIndex + delta + sidebarMainItems.length) % sidebarMainItems.length;
    if (selectedSidebarMainIndex !== previousIndex && activeSidebarMenuKey !== null) {
      setActiveSidebarMenu(null);
      selectedSidebarExpansionIndex = 0;
    }
    applySidebarSelection();
    if (selectedSidebarMainIndex !== previousIndex) {
      playUiSound("move");
    }
    return;
  }

  if (sidebarVolumeControlLocked) {
    return;
  }

  if (sidebarExpansionItems.length === 0) {
    return;
  }

  const previousIndex = selectedSidebarExpansionIndex;
  selectedSidebarExpansionIndex = (selectedSidebarExpansionIndex + delta + sidebarExpansionItems.length) % sidebarExpansionItems.length;
  applySidebarSelection();
  if (selectedSidebarExpansionIndex !== previousIndex) {
    playUiSound("move");
  }
}

function moveSidebarFocusToZone(zone: SidebarFocusZone): void {
  if (sidebarFocusZone === zone) {
    return;
  }

  if (zone === "expansion" && sidebarExpansionItems.length === 0) {
    const key = toSidebarMenuKey(getSelectedSidebarMainItem()?.dataset.expansionKey);
    setActiveSidebarMenu(key);
    selectedSidebarExpansionIndex = 0;
  }

  sidebarFocusZone = zone;
  if (zone === "main") {
    setSidebarVolumeControlLocked(false);
  }
  applySidebarSelection();
  playUiSound("move");
}

function activateSidebarSelection(): void {
  if (sidebarFocusZone === "main") {
    const item = getSelectedSidebarMainItem();
    if (!item) {
      return;
    }

    const key = toSidebarMenuKey(item.dataset.expansionKey);
    setActiveSidebarMenu(key);
    sidebarFocusZone = "expansion";
    selectedSidebarExpansionIndex = 0;
    applySidebarSelection();
    return;
  }

  const item = getSelectedSidebarExpansionItem();
  if (!item) {
    return;
  }

  if (item === menuVolumeSliderEl) {
    setSidebarVolumeControlLocked(!sidebarVolumeControlLocked);
    return;
  }

  if (item instanceof HTMLButtonElement) {
    item.click();
  }
}

function openViewModeDialog(): void {
  closeSettingsSidebar();
  viewModeDialogEl?.showModal();
  selectedViewModeIndex = viewMode === "grid" ? 0 : 1;
  applyViewModeSelection();
}

function closeViewModeDialog(): void {
  viewModeDialogEl?.close();
}

function getViewModeButtons(): HTMLButtonElement[] {
  return [viewModeGridButtonEl, viewModeCarouselButtonEl, viewModeCancelButtonEl].filter(
    (button): button is HTMLButtonElement => Boolean(button)
  );
}

function applyViewModeSelection(): void {
  const buttons = getViewModeButtons();
  if (buttons.length === 0) {
    return;
  }

  selectedViewModeIndex = Math.max(0, Math.min(selectedViewModeIndex, buttons.length - 1));

  buttons.forEach((button, index) => {
    button.classList.toggle("confirm-selected", index === selectedViewModeIndex);
  });

  focusWithoutScroll(buttons[selectedViewModeIndex] ?? null);
}

function moveViewModeSelection(delta: number): void {
  const buttons = getViewModeButtons();
  if (buttons.length === 0) {
    return;
  }

  const previousIndex = selectedViewModeIndex;
  selectedViewModeIndex = (selectedViewModeIndex + delta + buttons.length) % buttons.length;
  applyViewModeSelection();
  if (selectedViewModeIndex !== previousIndex) {
    playUiSound("move");
  }
}

function confirmViewModeSelection(): void {
  const buttons = getViewModeButtons();
  const action = buttons[selectedViewModeIndex];

  playUiSound("select");

  if (action === viewModeGridButtonEl) {
    setViewMode("grid");
    closeViewModeDialog();
    return;
  }

  if (action === viewModeCarouselButtonEl) {
    setViewMode("carousel");
    closeViewModeDialog();
    return;
  }

  closeViewModeDialog();
}

async function rebuildImageSnapshots(): Promise<void> {
  let rebuiltCount = 0;
  let skippedCount = 0;

  for (const app of apps) {
    if (app.coverPath.trim()) {
      try {
        const coverDataUrl = await getImageDataUrl(app.coverPath);
        app.coverSnapshotDataUrl = await buildSnapshotDataUrl(coverDataUrl, 240, 360, 0.82);
        rebuiltCount += 1;
      } catch {
        skippedCount += 1;
      }
    }

    if (app.backgroundPath.trim()) {
      try {
        const backgroundDataUrl = await getImageDataUrl(app.backgroundPath);
        app.backgroundSnapshotDataUrl = await buildSnapshotDataUrl(backgroundDataUrl, 640, 360, 0.78);
        rebuiltCount += 1;
      } catch {
        skippedCount += 1;
      }
    }
  }

  saveApps();
  renderGrid();
  applySelection();

  if (statusEl) {
    statusEl.textContent = `Rebuild Images complete. Rebuilt: ${rebuiltCount}, skipped: ${skippedCount}`;
  }
}

function applySelection(): void {
  const fastNavigation = isFastNavigationActive();
  const selectedCardIndex = viewMode === "carousel" ? Math.min(1, cards.length - 1) : selectedIndex;

  cards.forEach((card, index) => {
    card.classList.toggle("selected", navigationTarget === "grid" && index === selectedCardIndex);
    card.classList.remove("show-title");
  });

  if (titleRevealTimerId !== null) {
    clearTimeout(titleRevealTimerId);
    titleRevealTimerId = null;
  }

  if (navigationTarget === "grid") {
    const selectedCard = cards[selectedCardIndex];
    if (!fastNavigation && selectedCard?.classList.contains("has-cover")) {
      const revealIndex = selectedCardIndex;
      titleRevealTimerId = window.setTimeout(() => {
        const expectedRevealIndex = viewMode === "carousel" ? Math.min(1, cards.length - 1) : selectedIndex;
        if (revealIndex === expectedRevealIndex && navigationTarget === "grid") {
          cards[revealIndex]?.classList.add("show-title");
        }
        titleRevealTimerId = null;
      }, 750);
    }

    if (viewMode !== "carousel") {
      selectedCard?.scrollIntoView({
        behavior: fastNavigation ? "auto" : "smooth",
        block: "nearest",
        inline: "nearest"
      });
    }
  }

  if (statusEl && apps[selectedIndex] && navigationTarget === "grid") {
    statusEl.textContent = `Focused: ${apps[selectedIndex].name}`;
  }

  updateUsageTimeDisplay();

  void applyFocusedBackground();
}

async function activateSelected(): Promise<void> {
  const app = getSelectedApp();
  if (!statusEl || !app) {
    return;
  }

  playUiSound("launch");
  statusEl.textContent = `Launching: ${app.name}`;

  try {
    const launched = await invoke<LaunchAppResult>("launch_app", { path: app.launchPath, args: app.launchArgs });
    statusEl.textContent = `Launched: ${app.name}`;
    if (launched.pid > 0) {
      startUsageSession(app.id, launched.pid);
    }
  } catch (error) {
    playUiSound("error");
    statusEl.textContent = `Failed to launch ${app.name}`;
    console.error(error);
  }
}

async function deleteSelectedApp(): Promise<void> {
  const app = getSelectedApp();
  if (!app) {
    return;
  }

  if (activeUsageAppId === app.id) {
    await finalizeActiveUsageSession();
  }

  apps.splice(selectedIndex, 1);
  selectedIndex = Math.max(0, Math.min(selectedIndex, apps.length - 1));
  saveApps();
  renderGrid();

  if (statusEl) {
    statusEl.textContent = `Deleted: ${app.name}`;
  }
}

function getBulkDeleteAppButtons(): HTMLButtonElement[] {
  if (!bulkDeleteListEl) {
    return [];
  }
  return Array.from(bulkDeleteListEl.querySelectorAll<HTMLButtonElement>(".bulk-delete-item"));
}

function getBulkDeleteActionButtons(): HTMLButtonElement[] {
  return [
    bulkSelectAllButtonEl,
    bulkClearSelectionButtonEl,
    bulkDeleteSelectedButtonEl,
    bulkDeleteCancelButtonEl
  ].filter((button): button is HTMLButtonElement => Boolean(button));
}

function getBulkDeleteFocusableButtons(): HTMLButtonElement[] {
  return [...getBulkDeleteAppButtons(), ...getBulkDeleteActionButtons()];
}

function setBulkDeleteStatusText(): void {
  if (!statusEl) {
    return;
  }

  const total = apps.length;
  const marked = bulkDeleteSelectedAppIds.size;
  statusEl.textContent = `Bulk delete: ${marked} selected of ${total}`;
}

function renderBulkDeleteList(): void {
  if (!bulkDeleteListEl) {
    return;
  }

  bulkDeleteListEl.innerHTML = "";

  for (const app of apps) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "bulk-delete-item";
    item.dataset.appId = app.id;

    const selected = bulkDeleteSelectedAppIds.has(app.id);
    item.classList.toggle("bulk-marked", selected);
    item.setAttribute("aria-pressed", selected ? "true" : "false");

    const indicator = document.createElement("span");
    indicator.className = "bulk-delete-indicator";
    indicator.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "bulk-delete-name";
    name.textContent = app.name;

    item.append(indicator, name);

    item.addEventListener("click", () => {
      if (bulkDeleteSelectedAppIds.has(app.id)) {
        bulkDeleteSelectedAppIds.delete(app.id);
      } else {
        bulkDeleteSelectedAppIds.add(app.id);
      }
      renderBulkDeleteList();
      applyBulkDeleteCursor();
      setBulkDeleteStatusText();
      playUiSound("move");
    });

    bulkDeleteListEl.append(item);
  }
}

function applyBulkDeleteCursor(): void {
  const buttons = getBulkDeleteFocusableButtons();
  if (buttons.length === 0) {
    return;
  }

  bulkDeleteCursorIndex = Math.max(0, Math.min(bulkDeleteCursorIndex, buttons.length - 1));

  for (const button of buttons) {
    button.classList.remove("bulk-focused", "confirm-selected");
  }

  const focused = buttons[bulkDeleteCursorIndex] ?? null;
  if (!focused) {
    return;
  }

  if (focused.classList.contains("bulk-delete-item")) {
    focused.classList.add("bulk-focused");
    focused.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
  } else {
    focused.classList.add("confirm-selected");
  }

  focusWithoutScroll(focused);
}

function moveBulkDeleteCursor(delta: number): void {
  const buttons = getBulkDeleteFocusableButtons();
  if (buttons.length === 0) {
    return;
  }

  const previousIndex = bulkDeleteCursorIndex;
  bulkDeleteCursorIndex = Math.max(0, Math.min(buttons.length - 1, bulkDeleteCursorIndex + delta));
  applyBulkDeleteCursor();

  if (bulkDeleteCursorIndex !== previousIndex) {
    playUiSound("move");
  }
}

function closeBulkDeleteDialog(): void {
  bulkDeleteDialogEl?.close();
  playUiSound("back");
}

function selectAllForBulkDelete(): void {
  bulkDeleteSelectedAppIds.clear();
  for (const app of apps) {
    bulkDeleteSelectedAppIds.add(app.id);
  }
  renderBulkDeleteList();
  applyBulkDeleteCursor();
  setBulkDeleteStatusText();
  playUiSound("select");
}

function clearBulkDeleteSelection(): void {
  bulkDeleteSelectedAppIds.clear();
  renderBulkDeleteList();
  applyBulkDeleteCursor();
  setBulkDeleteStatusText();
  playUiSound("select");
}

function openBulkDeleteDialog(): void {
  if (!bulkDeleteDialogEl) {
    return;
  }

  if (apps.length === 0) {
    if (statusEl) {
      statusEl.textContent = "No apps available for bulk delete.";
    }
    return;
  }

  bulkDeleteSelectedAppIds.clear();
  bulkDeleteCursorIndex = 0;
  renderBulkDeleteList();
  bulkDeleteDialogEl.showModal();
  applyBulkDeleteCursor();
  setBulkDeleteStatusText();
  playUiSound("open");
}

async function deleteBulkSelectedApps(): Promise<void> {
  if (bulkDeleteSelectedAppIds.size === 0) {
    if (statusEl) {
      statusEl.textContent = "No apps selected for bulk delete.";
    }
    return;
  }

  const beforeCount = apps.length;

  if (activeUsageAppId && bulkDeleteSelectedAppIds.has(activeUsageAppId)) {
    await finalizeActiveUsageSession();
  }

  const nextApps = apps.filter((app) => !bulkDeleteSelectedAppIds.has(app.id));
  const removedCount = beforeCount - nextApps.length;

  if (removedCount <= 0) {
    return;
  }

  apps = nextApps;
  selectedIndex = Math.max(0, Math.min(selectedIndex, apps.length - 1));
  saveApps();
  renderGrid();
  applySelection();
  bulkDeleteSelectedAppIds.clear();
  closeBulkDeleteDialog();
  playUiSound("select");

  if (statusEl) {
    statusEl.textContent = `Bulk deleted ${removedCount} app${removedCount === 1 ? "" : "s"}.`;
  }
}

async function buildPortableExportApps(): Promise<LauncherApp[]> {
  const portable: LauncherApp[] = [];

  for (const app of apps) {
    let coverSnapshotDataUrl = app.coverSnapshotDataUrl.trim();
    let backgroundSnapshotDataUrl = app.backgroundSnapshotDataUrl.trim();

    if (!coverSnapshotDataUrl && app.coverPath.trim()) {
      try {
        const coverDataUrl = await getImageDataUrl(app.coverPath);
        coverSnapshotDataUrl = await buildSnapshotDataUrl(coverDataUrl, 240, 360, 0.82);
      } catch {
        // Keep best effort export if source file is unavailable.
      }
    }

    if (!backgroundSnapshotDataUrl && app.backgroundPath.trim()) {
      try {
        const backgroundDataUrl = await getImageDataUrl(app.backgroundPath);
        backgroundSnapshotDataUrl = await buildSnapshotDataUrl(backgroundDataUrl, 640, 360, 0.78);
      } catch {
        // Keep best effort export if source file is unavailable.
      }
    }

    portable.push({
      ...app,
      coverSnapshotDataUrl,
      backgroundSnapshotDataUrl
    });
  }

  return portable;
}

async function exportLibraryBundle(): Promise<void> {
  if (apps.length === 0) {
    if (statusEl) {
      statusEl.textContent = "Library is empty. Nothing to export.";
    }
    return;
  }

  const selected = await save({
    title: "Export Smart TV Library",
    defaultPath: `smarttv-library-${new Date().toISOString().slice(0, 10)}.smarttvlib`,
    filters: [
      {
        name: "Smart TV Library",
        extensions: ["smarttvlib", "json"]
      }
    ]
  });

  const exportPath = normalizeDialogPath(selected);
  if (!exportPath) {
    if (statusEl) {
      statusEl.textContent = "Export canceled.";
    }
    return;
  }

  if (statusEl) {
    statusEl.textContent = "Preparing export bundle...";
  }

  try {
    const portableApps = await buildPortableExportApps();
    const payload = JSON.stringify(
      {
        format: "smarttv-library",
        version: 1,
        exportedAt: new Date().toISOString(),
        appCount: portableApps.length,
        apps: portableApps
      },
      null,
      2
    );

    await invoke("write_library_export_file", {
      path: exportPath,
      content: payload
    });

    if (statusEl) {
      statusEl.textContent = `Library exported: ${portableApps.length} apps`;
    }
    playUiSound("select");
  } catch (error) {
    console.error(error);
    if (statusEl) {
      statusEl.textContent = "Library export failed.";
    }
    playUiSound("error");
  }
}

async function restartSystem(): Promise<void> {
  try {
    if (statusEl) {
      statusEl.textContent = "Restarting system...";
    }
    playUiSound("select");
    await invoke("restart_system");
  } catch (error) {
    console.error(error);
    if (statusEl) {
      statusEl.textContent = "Failed to restart system.";
    }
    playUiSound("error");
  }
}

async function shutdownSystem(): Promise<void> {
  try {
    if (statusEl) {
      statusEl.textContent = "Shutting down system...";
    }
    playUiSound("select");
    await invoke("shutdown_system");
  } catch (error) {
    console.error(error);
    if (statusEl) {
      statusEl.textContent = "Failed to shut down system.";
    }
    playUiSound("error");
  }
}

function focusOptionButton(): void {
  optionButtons.forEach((button, index) => {
    button.classList.toggle("option-selected", index === selectedOptionIndex);
  });
  focusWithoutScroll(optionButtons[selectedOptionIndex] ?? null);
}

function moveOptionSelection(delta: number): void {
  if (optionButtons.length === 0) {
    return;
  }
  const previousIndex = selectedOptionIndex;
  selectedOptionIndex = (selectedOptionIndex + delta + optionButtons.length) % optionButtons.length;
  focusOptionButton();
  if (selectedOptionIndex !== previousIndex) {
    playUiSound("move");
  }
}

function closeOptionsDialog(): void {
  optionsDialogEl?.close();
  playUiSound("back");
}

function applyConfirmSelection(): void {
  deleteCancelButtonEl?.classList.toggle("confirm-selected", selectedConfirmIndex === 0);
  deleteAcceptButtonEl?.classList.toggle("confirm-selected", selectedConfirmIndex === 1);
  if (selectedConfirmIndex === 0) {
    focusWithoutScroll(deleteCancelButtonEl);
  } else {
    focusWithoutScroll(deleteAcceptButtonEl);
  }
}

function closeDeleteConfirmDialog(): void {
  deleteConfirmDialogEl?.close();
  playUiSound("back");
}

function openDeleteConfirmDialog(): void {
  const app = getSelectedApp();
  if (!app) {
    if (statusEl) {
      statusEl.textContent = "No focused app for delete.";
    }
    return;
  }

  if (deleteConfirmTextEl) {
    deleteConfirmTextEl.textContent = `Delete \"${app.name}\" from library?`;
  }

  selectedConfirmIndex = 1;
  deleteConfirmDialogEl?.showModal();
  applyConfirmSelection();
  playUiSound("open");
}

function openRenameDialog(): void {
  const app = getSelectedApp();
  if (!app || !renameDialogEl || !renameInputEl) {
    return;
  }

  renameInputEl.value = app.name;
  renameDialogEl.showModal();
  window.setTimeout(() => renameInputEl?.focus(), 0);
  playUiSound("open");
}

function closeRenameDialog(): void {
  renameDialogEl?.close();
  renameFormEl?.reset();
  playUiSound("back");
}

function openTitleDialog(): void {
  if (!titleDialogEl || !titleInputEl) {
    return;
  }

  titleInputEl.value = (appTitleEl?.textContent ?? DEFAULT_APP_TITLE).trim();
  titleDialogEl.showModal();
  window.setTimeout(() => titleInputEl?.focus(), 0);
  playUiSound("open");
}

function closeTitleDialog(): void {
  titleDialogEl?.close();
  titleFormEl?.reset();
  playUiSound("back");
}

function openLaunchOptionsDialog(): void {
  const app = getSelectedApp();
  if (!app || !launchOptionsDialogEl || !launchOptionsInputEl) {
    return;
  }

  launchOptionsInputEl.value = app.launchArgs;
  launchOptionsDialogEl.showModal();
  window.setTimeout(() => launchOptionsInputEl?.focus(), 0);
  playUiSound("open");
}

function closeLaunchOptionsDialog(): void {
  launchOptionsDialogEl?.close();
  launchOptionsFormEl?.reset();
  playUiSound("back");
}

function openCustomizeCoverDialog(): void {
  const app = getSelectedApp();
  if (!app || !customizeCoverDialogEl || !coverPathInputEl || !backgroundPathInputEl) {
    return;
  }

  coverPathInputEl.value = app.coverPath;
  backgroundPathInputEl.value = app.backgroundPath;
  customizeCoverDialogEl.showModal();
  window.setTimeout(() => coverPathInputEl?.focus(), 0);
  playUiSound("open");
}

function closeCustomizeCoverDialog(): void {
  customizeCoverDialogEl?.close();
  customizeCoverFormEl?.reset();
  playUiSound("back");
}

async function browseForCoverPath(): Promise<void> {
  const selected = await open({
    title: "Select 6:9 cover image",
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"]
      }
    ]
  });

  if (!coverPathInputEl) {
    return;
  }

  const selectedPath = normalizeDialogPath(selected);
  if (!selectedPath) {
    return;
  }

  coverPathInputEl.value = selectedPath;
}

async function browseForAddCoverPath(): Promise<void> {
  const selected = await open({
    title: "Select 6:9 cover image",
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"]
      }
    ]
  });

  if (!appCoverPathInputEl) {
    return;
  }

  const selectedPath = normalizeDialogPath(selected);
  if (!selectedPath) {
    return;
  }

  appCoverPathInputEl.value = selectedPath;
}

async function browseForBackgroundPath(): Promise<void> {
  const selected = await open({
    title: "Select 16:9 or 5:4 background image",
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"]
      }
    ]
  });

  if (!backgroundPathInputEl) {
    return;
  }

  const selectedPath = normalizeDialogPath(selected);
  if (!selectedPath) {
    return;
  }

  backgroundPathInputEl.value = selectedPath;
}

async function browseForAddBackgroundPath(): Promise<void> {
  const selected = await open({
    title: "Select 16:9 or 5:4 background image",
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"]
      }
    ]
  });

  if (!appBackgroundPathInputEl) {
    return;
  }

  const selectedPath = normalizeDialogPath(selected);
  if (!selectedPath) {
    return;
  }

  appBackgroundPathInputEl.value = selectedPath;
}

async function confirmDeleteSelection(): Promise<void> {
  const app = getSelectedApp();
  if (!app) {
    closeDeleteConfirmDialog();
    return;
  }

  if (selectedConfirmIndex === 0) {
    if (statusEl) {
      statusEl.textContent = `Delete canceled: ${app.name}`;
    }
    closeDeleteConfirmDialog();
    return;
  }

  playUiSound("select");
  closeDeleteConfirmDialog();
  await deleteSelectedApp();
}

async function runOptionAction(action: OptionAction): Promise<void> {
  const app = getSelectedApp();
  if (!app) {
    if (statusEl) {
      statusEl.textContent = "No focused app for this action.";
    }
    closeOptionsDialog();
    return;
  }

  playUiSound("select");

  switch (action) {
    case "launch":
      closeOptionsDialog();
      await activateSelected();
      break;
    case "delete":
      closeOptionsDialog();
      openDeleteConfirmDialog();
      break;
    case "launch-options":
      closeOptionsDialog();
      openLaunchOptionsDialog();
      break;
    case "rename":
      closeOptionsDialog();
      openRenameDialog();
      break;
    case "customize":
      closeOptionsDialog();
      openCustomizeCoverDialog();
      break;
    default:
      break;
  }
}

function openOptionsDialog(): void {
  const app = getSelectedApp();
  if (!app) {
    if (statusEl) {
      statusEl.textContent = "No focused app. Move to a tile first.";
    }
    return;
  }

  optionsTitleEl = optionsTitleEl ?? document.querySelector("#options-title");
  if (optionsTitleEl) {
    optionsTitleEl.textContent = app.name;
  }

  optionsDialogEl?.showModal();
  selectedOptionIndex = 0;
  focusOptionButton();
  playUiSound("open");
}

function openAddDialog(): void {
  addDialogEl?.showModal();
  window.setTimeout(() => appNameInputEl?.focus(), 0);
  playUiSound("open");
}

function closeAddDialog(): void {
  addDialogEl?.close();
  addFormEl?.reset();
  playUiSound("back");
}

async function browseForPath(): Promise<void> {
  const selected = await open({
    title: "Select app executable or shortcut",
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Apps and Shortcuts",
        extensions: ["exe", "lnk", "bat", "cmd", "url"]
      }
    ]
  });

  if (!appPathInputEl) {
    return;
  }

  const selectedPath = normalizeDialogPath(selected);
  if (!selectedPath) {
    if (statusEl) {
      statusEl.textContent = "Selection canceled.";
    }
    return;
  }

  let finalPath = selectedPath;
  let finalArgs = "";

  if (isShortcutPath(selectedPath)) {
    try {
      const resolved = await invoke<ShortcutResolution>("resolve_shortcut", { path: selectedPath });
      if (resolved.targetPath?.trim()) {
        finalPath = resolved.targetPath.trim();
      }
      finalArgs = resolved.arguments?.trim() ?? "";

      if (statusEl) {
        statusEl.textContent = `Shortcut resolved: ${finalPath}`;
      }
    } catch (error) {
      if (statusEl) {
        statusEl.textContent = "Could not resolve shortcut target. Using shortcut path.";
      }
      console.error(error);
    }
  }

  appPathInputEl.value = finalPath;

  if (appArgsInputEl && !appArgsInputEl.value.trim() && finalArgs) {
    appArgsInputEl.value = finalArgs;
  }

  if (appNameInputEl && !appNameInputEl.value.trim()) {
    appNameInputEl.value = inferNameFromPath(isShortcutPath(selectedPath) ? selectedPath : finalPath);
  }

  if (statusEl && !isShortcutPath(selectedPath)) {
    statusEl.textContent = `Selected path: ${finalPath}`;
  }
}

function addApp(
  name: string,
  launchPath: string,
  launchArgs: string,
  coverPath: string,
  backgroundPath: string,
  coverSnapshotDataUrl: string,
  backgroundSnapshotDataUrl: string
): void {
  const item: LauncherApp = {
    id: crypto.randomUUID(),
    name: name.trim(),
    launchPath: launchPath.trim(),
    launchArgs: launchArgs.trim(),
    coverPath: coverPath.trim(),
    backgroundPath: backgroundPath.trim(),
    coverSnapshotDataUrl: coverSnapshotDataUrl.trim(),
    backgroundSnapshotDataUrl: backgroundSnapshotDataUrl.trim(),
    usageSeconds: 0
  };

  apps.push(item);
  saveApps();
  renderGrid();
  selectedIndex = apps.length - 1;
  applySelection();
}

function onKeyDown(event: KeyboardEvent): void {
  if (viewModeDialogEl?.open) {
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
      case "g":
      case "G":
        event.preventDefault();
        moveViewModeSelection(-1);
        break;
      case "ArrowRight":
      case "ArrowDown":
      case "c":
      case "C":
        event.preventDefault();
        moveViewModeSelection(1);
        break;
      case "Enter":
      case " ":
      case "x":
      case "X":
        event.preventDefault();
        if (!event.repeat) {
          confirmViewModeSelection();
        }
        break;
      case "Escape":
      case "Backspace":
        event.preventDefault();
        playUiSound("back");
        closeViewModeDialog();
        break;
      default:
        break;
    }
    return;
  }

  if (appShellEl?.classList.contains("sidebar-open")) {
    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        if (!sidebarVolumeControlLocked) {
          moveSidebarSelection(-1);
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        if (!sidebarVolumeControlLocked) {
          moveSidebarSelection(1);
        }
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (sidebarFocusZone === "expansion" && isVolumeSliderSelected() && sidebarVolumeControlLocked) {
          if (nudgeUiVolume(-5)) {
            playUiSound("move");
            if (statusEl) {
              statusEl.textContent = `UI volume: ${uiVolumePercent}%`;
            }
          }
        }
        break;
      case "ArrowRight":
        event.preventDefault();
        if (sidebarFocusZone === "expansion" && isVolumeSliderSelected() && sidebarVolumeControlLocked) {
          if (nudgeUiVolume(5)) {
            playUiSound("move");
            if (statusEl) {
              statusEl.textContent = `UI volume: ${uiVolumePercent}%`;
            }
          }
        } else if (sidebarFocusZone === "expansion") {
          moveSidebarFocusToZone("main");
        }
        break;
      case "Enter":
      case " ":
      case "x":
      case "X":
        event.preventDefault();
        if (!event.repeat) {
          playUiSound("select");
          activateSidebarSelection();
        }
        break;
      case "Escape":
      case "Backspace":
        event.preventDefault();
        if (sidebarVolumeControlLocked) {
          setSidebarVolumeControlLocked(false);
        } else if (sidebarFocusZone === "expansion") {
          moveSidebarFocusToZone("main");
        } else {
          closeSettingsSidebar();
        }
        break;
      default:
        break;
    }
    return;
  }

  if (bulkDeleteDialogEl?.open) {
    switch (event.key) {
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        moveBulkDeleteCursor(-1);
        break;
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        moveBulkDeleteCursor(1);
        break;
      case "Enter":
      case " ":
      case "x":
      case "X": {
        event.preventDefault();
        const button = getBulkDeleteFocusableButtons()[bulkDeleteCursorIndex];
        button?.click();
        break;
      }
      case "Escape":
      case "Backspace":
        event.preventDefault();
        closeBulkDeleteDialog();
        break;
      default:
        break;
    }
    return;
  }

  if (
    addDialogEl?.open
    || renameDialogEl?.open
    || titleDialogEl?.open
    || launchOptionsDialogEl?.open
    || customizeCoverDialogEl?.open
  ) {
    return;
  }

  if (deleteConfirmDialogEl?.open) {
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        selectedConfirmIndex = 0;
        applyConfirmSelection();
        break;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        selectedConfirmIndex = 1;
        applyConfirmSelection();
        break;
      case "Enter":
      case " ":
      case "x":
      case "X":
        event.preventDefault();
        playUiSound("select");
        void confirmDeleteSelection();
        break;
      case "Escape":
      case "Backspace":
        event.preventDefault();
        selectedConfirmIndex = 0;
        playUiSound("back");
        void confirmDeleteSelection();
        break;
      default:
        break;
    }
    return;
  }

  if (optionsDialogEl?.open) {
    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        moveOptionSelection(-1);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveOptionSelection(1);
        break;
      case "Enter":
      case " ":
      case "x":
      case "X": {
        event.preventDefault();
        const action = optionButtons[selectedOptionIndex]?.dataset.action as OptionAction | undefined;
        if (action) {
          void runOptionAction(action);
        }
        break;
      }
      case "Escape":
      case "Backspace":
        event.preventDefault();
        closeOptionsDialog();
        break;
      default:
        break;
    }
    return;
  }

  switch (event.key) {
    case "ArrowLeft": {
      event.preventDefault();
      const now = performance.now();
      if (event.repeat && now - lastKeyboardMoveAt < 160) return;
      if (event.repeat) {
        markFastNavigationWindow();
      }
      lastKeyboardMoveAt = now;
      if (navigationTarget === "add-button") {
        if (apps.length > 0) {
          // Keep the previously focused tile when returning from Settings.
          setNavigationTarget("grid");
          applySelection();
        }
        break;
      }
      moveSelection(-1, 0);
      break;
    }
    case "ArrowRight": {
      event.preventDefault();
      const now = performance.now();
      if (event.repeat && now - lastKeyboardMoveAt < 160) return;
      if (event.repeat) {
        markFastNavigationWindow();
      }
      lastKeyboardMoveAt = now;
      if (navigationTarget === "add-button") {
        if (apps.length > 0) {
          // Keep the previously focused tile when returning from Settings.
          setNavigationTarget("grid");
          applySelection();
        }
      } else if (viewMode === "grid") {
        const current = getRowAndColumn(selectedIndex);
        const row = rowLayout[current.row];
        if (current.row === 0 && current.col === row.count - 1) {
          setNavigationTarget("add-button");
        } else {
          moveSelection(1, 0);
        }
      } else {
        moveSelection(1, 0);
      }
      break;
    }
    case "ArrowUp": {
      event.preventDefault();
      const now = performance.now();
      if (event.repeat && now - lastKeyboardMoveAt < 160) return;
      if (event.repeat) {
        markFastNavigationWindow();
      }
      lastKeyboardMoveAt = now;
      if (navigationTarget === "add-button") {
        break;
      }
      if (viewMode === "grid") {
        const current = getRowAndColumn(selectedIndex);
        if (current.row === 0) {
          setNavigationTarget("add-button");
        } else {
          moveSelection(0, -1);
        }
      } else {
        setNavigationTarget("add-button");
      }
      break;
    }
    case "ArrowDown": {
      event.preventDefault();
      const now = performance.now();
      if (event.repeat && now - lastKeyboardMoveAt < 160) return;
      if (event.repeat) {
        markFastNavigationWindow();
      }
      lastKeyboardMoveAt = now;
      if (navigationTarget === "add-button") {
        setNavigationTarget("grid");
        applySelection();
        break;
      }
      if (viewMode === "grid") {
        moveSelection(0, 1);
      }
      break;
    }
    case "Enter":
    case "x":
    case "X":
      event.preventDefault();
      if (!event.repeat) {
        playUiSound("select");
        if (navigationTarget === "add-button") {
          openSettingsSidebar();
        } else {
          void activateSelected();
        }
      }
      break;
    case " ":
      event.preventDefault();
      if (!event.repeat) {
        playUiSound("select");
        if (navigationTarget === "add-button") {
          openSettingsSidebar();
        } else {
          openOptionsDialog();
        }
      }
      break;
    case "a":
    case "A":
      event.preventDefault();
      openAddDialog();
      break;
    default:
      break;
  }
}

function getGamepadDirection(pad: Gamepad): [number, number] {
  const deadzone = 0.45;

  let dx = 0;
  let dy = 0;

  if (pad.buttons[14]?.pressed || pad.axes[0] < -deadzone) {
    dx = -1;
  } else if (pad.buttons[15]?.pressed || pad.axes[0] > deadzone) {
    dx = 1;
  }

  if (pad.buttons[12]?.pressed || pad.axes[1] < -deadzone) {
    dy = -1;
  } else if (pad.buttons[13]?.pressed || pad.axes[1] > deadzone) {
    dy = 1;
  }

  return [dx, dy];
}

function pollGamepad(): void {
  const pads = navigator.getGamepads();
  const pad = pads.find((candidate) => candidate && candidate.connected);

  if (
    pad
    && !addDialogEl?.open
    && !renameDialogEl?.open
    && !titleDialogEl?.open
    && !launchOptionsDialogEl?.open
    && !customizeCoverDialogEl?.open
  ) {
    if (bulkDeleteDialogEl?.open) {
      const [dx, dy] = getGamepadDirection(pad);
      const directionKey = `${dx},${dy}`;
      const now = performance.now();

      if ((dx !== 0 || dy !== 0) && (directionKey !== lastDirection || now >= nextMoveAt)) {
        if (dx > 0 || dy > 0) {
          moveBulkDeleteCursor(1);
        } else if (dx < 0 || dy < 0) {
          moveBulkDeleteCursor(-1);
        }
        nextMoveAt = now + (directionKey !== lastDirection ? 300 : 180);
      }

      lastDirection = directionKey;

      const actionPressed = Boolean(pad.buttons[0]?.pressed || pad.buttons[2]?.pressed);
      if (actionPressed && !previousActionPressed) {
        const button = getBulkDeleteFocusableButtons()[bulkDeleteCursorIndex];
        button?.click();
      }
      previousActionPressed = actionPressed;

      const backPressed = Boolean(pad.buttons[1]?.pressed);
      if (backPressed && !previousBackPressed) {
        closeBulkDeleteDialog();
      }
      previousBackPressed = backPressed;

      const startPressed = Boolean(pad.buttons[9]?.pressed);
      if (startPressed && !previousStartPressed) {
        closeBulkDeleteDialog();
      }
      previousStartPressed = startPressed;
      window.requestAnimationFrame(pollGamepad);
      return;
    }

    if (viewModeDialogEl?.open) {
      const [dx, dy] = getGamepadDirection(pad);
      const directionKey = `${dx},${dy}`;
      const now = performance.now();

      if ((dx !== 0 || dy !== 0) && (directionKey !== lastDirection || now >= nextMoveAt)) {
        if (directionKey === lastDirection) {
          markFastNavigationWindow();
        }
        if (dx > 0 || dy > 0) {
          moveViewModeSelection(1);
        } else if (dx < 0 || dy < 0) {
          moveViewModeSelection(-1);
        }
        nextMoveAt = now + (directionKey !== lastDirection ? 300 : 180);
      }

      lastDirection = directionKey;

      const actionPressed = Boolean(pad.buttons[0]?.pressed || pad.buttons[2]?.pressed);
      if (actionPressed && !previousActionPressed) {
        confirmViewModeSelection();
      }
      previousActionPressed = actionPressed;

      const backPressed = Boolean(pad.buttons[1]?.pressed);
      if (backPressed && !previousBackPressed) {
        playUiSound("back");
        closeViewModeDialog();
      }
      previousBackPressed = backPressed;

      const startPressed = Boolean(pad.buttons[9]?.pressed);
      if (startPressed && !previousStartPressed) {
        playUiSound("back");
        closeViewModeDialog();
      }
      previousStartPressed = startPressed;
      window.requestAnimationFrame(pollGamepad);
      return;
    }

    if (appShellEl?.classList.contains("sidebar-open")) {
      const [dx, dy] = getGamepadDirection(pad);
      const directionKey = `${dx},${dy}`;
      const now = performance.now();

      if ((dx !== 0 || dy !== 0) && (directionKey !== lastDirection || now >= nextMoveAt)) {
        if (directionKey === lastDirection) {
          markFastNavigationWindow();
        }
        if (sidebarVolumeControlLocked && isVolumeSliderSelected()) {
          if (dx !== 0 && nudgeUiVolume(dx > 0 ? 5 : -5)) {
            playUiSound("move");
            if (statusEl) {
              statusEl.textContent = `UI volume: ${uiVolumePercent}%`;
            }
          }
        } else if (dy !== 0) {
          moveSidebarSelection(dy > 0 ? 1 : -1);
        } else if (dx > 0 && sidebarFocusZone === "expansion" && !isVolumeSliderSelected()) {
          moveSidebarFocusToZone("main");
        } else if (dx > 0 && sidebarFocusZone === "expansion" && isVolumeSliderSelected() && !sidebarVolumeControlLocked) {
          moveSidebarFocusToZone("main");
        }
        nextMoveAt = now + (directionKey !== lastDirection ? 300 : 180);
      }

      lastDirection = directionKey;

      const actionPressed = Boolean(pad.buttons[0]?.pressed || pad.buttons[2]?.pressed);
      if (actionPressed && !previousActionPressed) {
        playUiSound("select");
        activateSidebarSelection();
      }
      previousActionPressed = actionPressed;

      const backPressed = Boolean(pad.buttons[1]?.pressed);
      if (backPressed && !previousBackPressed) {
        if (sidebarVolumeControlLocked) {
          setSidebarVolumeControlLocked(false);
        } else if (sidebarFocusZone === "expansion") {
          moveSidebarFocusToZone("main");
        } else {
          closeSettingsSidebar();
        }
      }
      previousBackPressed = backPressed;

      const startPressed = Boolean(pad.buttons[9]?.pressed);
      if (startPressed && !previousStartPressed) {
        if (sidebarVolumeControlLocked) {
          setSidebarVolumeControlLocked(false);
        } else if (sidebarFocusZone === "expansion") {
          moveSidebarFocusToZone("main");
        } else {
          closeSettingsSidebar();
        }
      }
      previousStartPressed = startPressed;
      window.requestAnimationFrame(pollGamepad);
      return;
    }

    const [dx, dy] = getGamepadDirection(pad);
    const directionKey = `${dx},${dy}`;
    const now = performance.now();

    if ((dx !== 0 || dy !== 0) && (directionKey !== lastDirection || now >= nextMoveAt)) {
      if (directionKey === lastDirection) {
        markFastNavigationWindow();
      }
      if (deleteConfirmDialogEl?.open) {
        if (dx < 0 || dy < 0) {
          selectedConfirmIndex = 0;
          applyConfirmSelection();
        }
        if (dx > 0 || dy > 0) {
          selectedConfirmIndex = 1;
          applyConfirmSelection();
        }
      } else if (optionsDialogEl?.open) {
        if (dy !== 0) {
          moveOptionSelection(dy > 0 ? 1 : -1);
        }
      } else {
        if (navigationTarget === "add-button") {
          if (dy > 0) {
            setNavigationTarget("grid");
            applySelection();
          } else if ((dx < 0 || dx > 0) && apps.length > 0) {
            // Keep the previously focused tile when returning from Settings.
            setNavigationTarget("grid");
            applySelection();
          }
        } else {
          if (viewMode === "grid") {
            const current = getRowAndColumn(selectedIndex);
            const row = rowLayout[current.row];

            if (dy < 0 && current.row === 0) {
              setNavigationTarget("add-button");
            } else if (dx > 0 && current.row === 0 && current.col === row.count - 1) {
              setNavigationTarget("add-button");
            } else {
              moveSelection(dx, dy);
            }
          } else if (dy < 0) {
            setNavigationTarget("add-button");
          } else {
            moveSelection(dx, 0);
          }
        }
      }
      nextMoveAt = now + (directionKey !== lastDirection ? 300 : 180);
    }

    lastDirection = directionKey;

    const actionPressed = Boolean(pad.buttons[0]?.pressed || pad.buttons[2]?.pressed);
    if (actionPressed && !previousActionPressed) {
      playUiSound("select");
      if (deleteConfirmDialogEl?.open) {
        void confirmDeleteSelection();
      } else if (optionsDialogEl?.open) {
        const action = optionButtons[selectedOptionIndex]?.dataset.action as OptionAction | undefined;
        if (action) {
          void runOptionAction(action);
        }
      } else {
        if (navigationTarget === "add-button") {
          openSettingsSidebar();
        } else {
          void activateSelected();
        }
      }
    }
    previousActionPressed = actionPressed;

    const backPressed = Boolean(pad.buttons[1]?.pressed);
    if (backPressed && !previousBackPressed) {
      if (deleteConfirmDialogEl?.open) {
        selectedConfirmIndex = 0;
        playUiSound("back");
        void confirmDeleteSelection();
      } else if (optionsDialogEl?.open) {
        closeOptionsDialog();
      }
    }
    previousBackPressed = backPressed;

    const startPressed = Boolean(pad.buttons[9]?.pressed);
    if (startPressed && !previousStartPressed && !optionsDialogEl?.open && !deleteConfirmDialogEl?.open) {
      playUiSound("open");
      toggleSettingsSidebar();
    }
    previousStartPressed = startPressed;
  } else {
    lastDirection = "0,0";
    previousActionPressed = false;
    previousBackPressed = false;
    previousStartPressed = false;
  }

  window.requestAnimationFrame(pollGamepad);
}

window.addEventListener("DOMContentLoaded", () => {
  appShellEl = document.querySelector(".app-shell");
  appBackgroundLayerAEl = document.querySelector(".app-background-layer-a");
  appBackgroundLayerBEl = document.querySelector(".app-background-layer-b");
  appTitleEl = document.querySelector(".top-bar h1");
  gridEl = document.querySelector("#grid");
  statusEl = document.querySelector("#status");
  usageTimeEl = document.querySelector("#usage-time");
  settingsButtonEl = document.querySelector("#settings-button");
  sidebarOverlayEl = document.querySelector("#sidebar-overlay");
  menuAddAppEl = document.querySelector("#menu-add-app");
  menuBulkDeleteEl = document.querySelector("#menu-bulk-delete");
  menuExportLibraryEl = document.querySelector("#menu-export-library");
  menuCustomizeTitleEl = document.querySelector("#menu-customize-title");
  menuViewModeEl = document.querySelector("#menu-view-mode");
  menuAspectEl = document.querySelector("#menu-aspect");
  menuRebuildImagesEl = document.querySelector("#menu-rebuild-images");
  menuCloseEl = document.querySelector("#menu-close");
  menuRestartSystemEl = document.querySelector("#menu-restart-system");
  menuShutdownSystemEl = document.querySelector("#menu-shutdown-system");
  menuVolumeSliderEl = document.querySelector("#menu-volume-slider");
  menuVolumeValueEl = document.querySelector("#menu-volume-value");
  sidebarMainItems = Array.from(document.querySelectorAll<HTMLButtonElement>(".sidebar-main-item"));
  sidebarExpansionPanels = Array.from(document.querySelectorAll<HTMLElement>(".sidebar-expansion-panel"));
  sidebarExpansionItems = Array.from(document.querySelectorAll<HTMLElement>(".sidebar-expansion-item"));
  addDialogEl = document.querySelector("#add-app-dialog");
  addFormEl = document.querySelector("#add-app-form");
  appNameInputEl = document.querySelector("#app-name");
  appPathInputEl = document.querySelector("#app-path");
  appArgsInputEl = document.querySelector("#app-args");
  appCoverPathInputEl = document.querySelector("#app-cover-path");
  appBackgroundPathInputEl = document.querySelector("#app-background-path");
  browsePathButtonEl = document.querySelector("#browse-app-path");
  browseAppCoverPathButtonEl = document.querySelector("#browse-app-cover-path");
  browseAppBackgroundPathButtonEl = document.querySelector("#browse-app-background-path");
  renameDialogEl = document.querySelector("#rename-dialog");
  renameFormEl = document.querySelector("#rename-form");
  renameInputEl = document.querySelector("#rename-input");
  titleDialogEl = document.querySelector("#title-dialog");
  titleFormEl = document.querySelector("#title-form");
  titleInputEl = document.querySelector("#title-input");
  launchOptionsDialogEl = document.querySelector("#launch-options-dialog");
  launchOptionsFormEl = document.querySelector("#launch-options-form");
  launchOptionsInputEl = document.querySelector("#launch-options-input");
  customizeCoverDialogEl = document.querySelector("#customize-cover-dialog");
  customizeCoverFormEl = document.querySelector("#customize-cover-form");
  coverPathInputEl = document.querySelector("#cover-path-input");
  backgroundPathInputEl = document.querySelector("#background-path-input");
  browseCoverPathButtonEl = document.querySelector("#browse-cover-path");
  browseBackgroundPathButtonEl = document.querySelector("#browse-background-path");
  clearCoverButtonEl = document.querySelector("#clear-cover");
  clearBackgroundButtonEl = document.querySelector("#clear-background");
  optionsDialogEl = document.querySelector("#app-options-dialog");
  optionsTitleEl = document.querySelector("#options-title");
  optionButtons = Array.from(document.querySelectorAll(".option-button"));
  deleteConfirmDialogEl = document.querySelector("#delete-confirm-dialog");
  deleteConfirmTextEl = document.querySelector("#delete-confirm-text");
  deleteCancelButtonEl = document.querySelector("#delete-cancel-button");
  deleteAcceptButtonEl = document.querySelector("#delete-accept-button");
  bulkDeleteDialogEl = document.querySelector("#bulk-delete-dialog");
  bulkDeleteListEl = document.querySelector("#bulk-delete-list");
  bulkSelectAllButtonEl = document.querySelector("#bulk-select-all-button");
  bulkClearSelectionButtonEl = document.querySelector("#bulk-clear-selection-button");
  bulkDeleteSelectedButtonEl = document.querySelector("#bulk-delete-selected-button");
  bulkDeleteCancelButtonEl = document.querySelector("#bulk-delete-cancel-button");
  viewModeDialogEl = document.querySelector("#view-mode-dialog");
  viewModeGridButtonEl = document.querySelector("#view-mode-grid-button");
  viewModeCarouselButtonEl = document.querySelector("#view-mode-carousel-button");
  viewModeCancelButtonEl = document.querySelector("#view-mode-cancel-button");

  apps = loadApps();
  viewMode = loadViewMode();
  uiVolumePercent = loadUiVolumePercent();
  applyAppTitle(loadAppTitle(), false);
  applyUiVolumePercent(uiVolumePercent, false);
  updateUsageTimeDisplay();
  if (gridEl) {
    gridEl.classList.toggle("view-grid", viewMode === "grid");
    gridEl.classList.toggle("view-carousel", viewMode === "carousel");
  }
  applyAspectPreset();
  renderGrid();

  settingsButtonEl?.addEventListener("click", () => {
    setNavigationTarget("add-button");
    toggleSettingsSidebar();
  });

  sidebarOverlayEl?.addEventListener("click", () => {
    closeSettingsSidebar();
  });

  menuAddAppEl?.addEventListener("click", () => {
    closeSettingsSidebar();
    openAddDialog();
  });

  menuBulkDeleteEl?.addEventListener("click", () => {
    closeSettingsSidebar();
    openBulkDeleteDialog();
  });

  menuExportLibraryEl?.addEventListener("click", () => {
    closeSettingsSidebar();
    void exportLibraryBundle();
  });

  menuCustomizeTitleEl?.addEventListener("click", () => {
    closeSettingsSidebar();
    openTitleDialog();
  });

  menuViewModeEl?.addEventListener("click", () => {
    openViewModeDialog();
  });

  menuAspectEl?.addEventListener("click", () => {
    cycleAspectPreset();
  });

  menuRebuildImagesEl?.addEventListener("click", () => {
    closeSettingsSidebar();
    void rebuildImageSnapshots();
  });

  menuCloseEl?.addEventListener("click", () => {
    closeSettingsSidebar();
  });

  menuRestartSystemEl?.addEventListener("click", () => {
    closeSettingsSidebar();
    void restartSystem();
  });

  menuShutdownSystemEl?.addEventListener("click", () => {
    closeSettingsSidebar();
    void shutdownSystem();
  });

  bulkSelectAllButtonEl?.addEventListener("click", () => {
    selectAllForBulkDelete();
  });

  bulkClearSelectionButtonEl?.addEventListener("click", () => {
    clearBulkDeleteSelection();
  });

  bulkDeleteSelectedButtonEl?.addEventListener("click", () => {
    void deleteBulkSelectedApps();
  });

  bulkDeleteCancelButtonEl?.addEventListener("click", () => {
    closeBulkDeleteDialog();
  });

  sidebarMainItems.forEach((item, index) => {
    item.addEventListener("click", () => {
      selectedSidebarMainIndex = index;
      const key = toSidebarMenuKey(item.dataset.expansionKey);
      setActiveSidebarMenu(key);
      sidebarFocusZone = "expansion";
      selectedSidebarExpansionIndex = 0;
      applySidebarSelection();
      playUiSound("select");
    });

    item.addEventListener("mouseenter", () => {
      selectedSidebarMainIndex = index;
      if (activeSidebarMenuKey !== null) {
        setActiveSidebarMenu(null);
        selectedSidebarExpansionIndex = 0;
      }
      applySidebarSelection();
    });

    item.addEventListener("focus", () => {
      selectedSidebarMainIndex = index;
      sidebarFocusZone = "main";
      if (activeSidebarMenuKey !== null) {
        setActiveSidebarMenu(null);
        selectedSidebarExpansionIndex = 0;
      }
      applySidebarSelection();
    });
  });

  sidebarExpansionItems.forEach((item) => {
    item.addEventListener("mouseenter", () => {
      refreshActiveSidebarExpansionItems();
      const nextIndex = sidebarExpansionItems.indexOf(item);
      selectedSidebarExpansionIndex = nextIndex >= 0 ? nextIndex : 0;
      applySidebarSelection();
    });

    item.addEventListener("focus", () => {
      refreshActiveSidebarExpansionItems();
      const nextIndex = sidebarExpansionItems.indexOf(item);
      selectedSidebarExpansionIndex = nextIndex >= 0 ? nextIndex : 0;
      sidebarFocusZone = "expansion";
      applySidebarSelection();
    });
  });

  menuVolumeSliderEl?.addEventListener("input", (event) => {
    const slider = event.currentTarget as HTMLInputElement | null;
    const next = Number.parseInt(slider?.value ?? "", 10);
    if (Number.isFinite(next)) {
      applyUiVolumePercent(next);
      if (statusEl) {
        statusEl.textContent = `UI volume: ${uiVolumePercent}%`;
      }
    }
  });

  menuVolumeSliderEl?.addEventListener("change", () => {
    playUiSound("move");
  });

  viewModeGridButtonEl?.addEventListener("click", () => {
    setViewMode("grid");
    closeViewModeDialog();
  });

  viewModeCarouselButtonEl?.addEventListener("click", () => {
    setViewMode("carousel");
    closeViewModeDialog();
  });

  viewModeCancelButtonEl?.addEventListener("click", () => {
    closeViewModeDialog();
  });

  viewModeDialogEl?.addEventListener("close", () => {
    selectedViewModeIndex = 0;
    viewModeGridButtonEl?.classList.remove("confirm-selected");
    viewModeCarouselButtonEl?.classList.remove("confirm-selected");
    viewModeCancelButtonEl?.classList.remove("confirm-selected");
  });

  viewModeGridButtonEl?.addEventListener("mouseenter", () => {
    selectedViewModeIndex = 0;
    applyViewModeSelection();
  });

  viewModeCarouselButtonEl?.addEventListener("mouseenter", () => {
    selectedViewModeIndex = 1;
    applyViewModeSelection();
  });

  viewModeCancelButtonEl?.addEventListener("mouseenter", () => {
    selectedViewModeIndex = 2;
    applyViewModeSelection();
  });

  viewModeGridButtonEl?.addEventListener("focus", () => {
    selectedViewModeIndex = 0;
    applyViewModeSelection();
  });

  viewModeCarouselButtonEl?.addEventListener("focus", () => {
    selectedViewModeIndex = 1;
    applyViewModeSelection();
  });

  viewModeCancelButtonEl?.addEventListener("focus", () => {
    selectedViewModeIndex = 2;
    applyViewModeSelection();
  });

  document.querySelector("#cancel-add")?.addEventListener("click", () => {
    closeAddDialog();
  });

  document.querySelector("#rename-cancel")?.addEventListener("click", () => {
    closeRenameDialog();
  });

  document.querySelector("#title-cancel")?.addEventListener("click", () => {
    closeTitleDialog();
  });

  document.querySelector("#launch-options-cancel")?.addEventListener("click", () => {
    closeLaunchOptionsDialog();
  });

  document.querySelector("#customize-cover-cancel")?.addEventListener("click", () => {
    closeCustomizeCoverDialog();
  });

  browsePathButtonEl?.addEventListener("click", () => {
    void browseForPath();
  });

  browseAppCoverPathButtonEl?.addEventListener("click", () => {
    void browseForAddCoverPath();
  });

  browseAppBackgroundPathButtonEl?.addEventListener("click", () => {
    void browseForAddBackgroundPath();
  });

  browseCoverPathButtonEl?.addEventListener("click", () => {
    void browseForCoverPath();
  });

  browseBackgroundPathButtonEl?.addEventListener("click", () => {
    void browseForBackgroundPath();
  });

  clearCoverButtonEl?.addEventListener("click", () => {
    if (coverPathInputEl) {
      coverPathInputEl.value = "";
    }
  });

  clearBackgroundButtonEl?.addEventListener("click", () => {
    if (backgroundPathInputEl) {
      backgroundPathInputEl.value = "";
    }
  });

  optionButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action as OptionAction | undefined;
      if (action) {
        void runOptionAction(action);
      }
    });

    button.addEventListener("mouseenter", () => {
      selectedOptionIndex = index;
      focusOptionButton();
    });
  });

  deleteCancelButtonEl?.addEventListener("click", () => {
    selectedConfirmIndex = 0;
    void confirmDeleteSelection();
  });

  deleteAcceptButtonEl?.addEventListener("click", () => {
    selectedConfirmIndex = 1;
    void confirmDeleteSelection();
  });

  addFormEl?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = appNameInputEl?.value ?? "";
    const launchPath = appPathInputEl?.value ?? "";
    const launchArgs = appArgsInputEl?.value ?? "";
    const coverPath = appCoverPathInputEl?.value ?? "";
    const backgroundPath = appBackgroundPathInputEl?.value ?? "";

    if (!name.trim() || !launchPath.trim()) {
      if (statusEl) {
        statusEl.textContent = "Name and launch path are required.";
      }
      return;
    }

    if (!(await validateBackgroundAspect(backgroundPath))) {
      return;
    }

    let coverSnapshotDataUrl = "";
    let backgroundSnapshotDataUrl = "";

    if (coverPath.trim()) {
      try {
        const coverDataUrl = await getImageDataUrl(coverPath);
        coverSnapshotDataUrl = await buildSnapshotDataUrl(coverDataUrl, 240, 360, 0.82);
      } catch (error) {
        console.warn("cover snapshot generation failed", error);
      }
    }

    if (backgroundPath.trim()) {
      try {
        const backgroundDataUrl = await getImageDataUrl(backgroundPath);
        backgroundSnapshotDataUrl = await buildSnapshotDataUrl(backgroundDataUrl, 640, 360, 0.78);
      } catch (error) {
        console.warn("background snapshot generation failed", error);
      }
    }

    addApp(
      name,
      launchPath,
      launchArgs,
      coverPath,
      backgroundPath,
      coverSnapshotDataUrl,
      backgroundSnapshotDataUrl
    );
    closeAddDialog();
  });

  renameFormEl?.addEventListener("submit", (event) => {
    event.preventDefault();
    const app = getSelectedApp();
    const nextName = renameInputEl?.value.trim() ?? "";
    if (!app || !nextName) {
      closeRenameDialog();
      return;
    }

    app.name = nextName;
    saveApps();
    renderGrid();
    applySelection();
    if (statusEl) {
      statusEl.textContent = `Renamed to: ${nextName}`;
    }
    closeRenameDialog();
  });

  titleFormEl?.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextTitle = titleInputEl?.value.trim() ?? "";
    if (!nextTitle) {
      closeTitleDialog();
      return;
    }

    applyAppTitle(nextTitle);
    if (statusEl) {
      statusEl.textContent = `Title updated: ${nextTitle}`;
    }
    playUiSound("select");
    titleDialogEl?.close();
    titleFormEl?.reset();
  });

  launchOptionsFormEl?.addEventListener("submit", (event) => {
    event.preventDefault();
    const app = getSelectedApp();
    if (!app) {
      closeLaunchOptionsDialog();
      return;
    }

    app.launchArgs = launchOptionsInputEl?.value.trim() ?? "";
    saveApps();
    if (statusEl) {
      statusEl.textContent = app.launchArgs
        ? `Launch options set: ${app.launchArgs}`
        : `Launch options cleared for ${app.name}`;
    }
    closeLaunchOptionsDialog();
  });

  customizeCoverFormEl?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const app = getSelectedApp();
    if (!app) {
      closeCustomizeCoverDialog();
      return;
    }

    const previousCoverPath = app.coverPath.trim();
    const previousBackgroundPath = app.backgroundPath.trim();
    const previousCoverSnapshotDataUrl = app.coverSnapshotDataUrl;
    const previousBackgroundSnapshotDataUrl = app.backgroundSnapshotDataUrl;
    app.coverPath = coverPathInputEl?.value.trim() ?? "";
    app.backgroundPath = backgroundPathInputEl?.value.trim() ?? "";

    if (!(await validateBackgroundAspect(app.backgroundPath))) {
      app.coverPath = previousCoverPath;
      app.backgroundPath = previousBackgroundPath;
      app.coverSnapshotDataUrl = previousCoverSnapshotDataUrl;
      app.backgroundSnapshotDataUrl = previousBackgroundSnapshotDataUrl;
      return;
    }

    if (app.coverPath) {
      try {
        const coverDataUrl = await getImageDataUrl(app.coverPath);
        app.coverSnapshotDataUrl = await buildSnapshotDataUrl(coverDataUrl, 240, 360, 0.82);
      } catch (error) {
        console.warn("cover snapshot refresh failed", error);
      }
    } else {
      app.coverSnapshotDataUrl = "";
    }

    if (app.backgroundPath) {
      try {
        const backgroundDataUrl = await getImageDataUrl(app.backgroundPath);
        app.backgroundSnapshotDataUrl = await buildSnapshotDataUrl(backgroundDataUrl, 640, 360, 0.78);
      } catch (error) {
        console.warn("background snapshot refresh failed", error);
      }
    } else {
      app.backgroundSnapshotDataUrl = "";
    }

    if (previousCoverPath) {
      coverDataUrlCache.delete(previousCoverPath);
      coverGradientCache.delete(previousCoverPath);
    }
    if (previousBackgroundPath) {
      coverDataUrlCache.delete(previousBackgroundPath);
    }
    saveApps();
    renderGrid();
    applySelection();
    if (statusEl) {
      statusEl.textContent = app.coverPath || app.backgroundPath
        ? `Media updated for ${app.name}`
        : `Media cleared for ${app.name}`;
    }
    closeCustomizeCoverDialog();
  });

  addDialogEl?.addEventListener("close", () => {
    addFormEl?.reset();
  });

  renameDialogEl?.addEventListener("close", () => {
    renameFormEl?.reset();
  });

  titleDialogEl?.addEventListener("close", () => {
    titleFormEl?.reset();
  });

  launchOptionsDialogEl?.addEventListener("close", () => {
    launchOptionsFormEl?.reset();
  });

  customizeCoverDialogEl?.addEventListener("close", () => {
    customizeCoverFormEl?.reset();
  });

  optionsDialogEl?.addEventListener("close", () => {
    selectedOptionIndex = 0;
    optionButtons.forEach((button) => button.classList.remove("option-selected"));
  });

  deleteConfirmDialogEl?.addEventListener("close", () => {
    selectedConfirmIndex = 0;
    deleteCancelButtonEl?.classList.remove("confirm-selected");
    deleteAcceptButtonEl?.classList.remove("confirm-selected");
  });

  bulkDeleteDialogEl?.addEventListener("close", () => {
    bulkDeleteCursorIndex = 0;
    bulkDeleteSelectedAppIds.clear();
    getBulkDeleteFocusableButtons().forEach((button) => {
      button.classList.remove("bulk-focused", "confirm-selected");
    });
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", () => {
    currentCarouselOffset = 0;
    stopCarouselAnimation();
    if (navigationTarget === "grid") {
      applySelection();
    }
  });
  window.requestAnimationFrame(pollGamepad);
});
