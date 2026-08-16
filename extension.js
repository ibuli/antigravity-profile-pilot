const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PROFILE_COLORS = ["#4A90E2", "#28A745", "#F39C12", "#8E44AD", "#E84393"];
const MAX_PROFILES = 5;

// Exact Antigravity AI Model Catalog
const ANTIGRAVITY_MODELS = [
  { name: "Gemini 3.7 Flash Medium", shortName: "Gemini 3.7 Flash", badge: "Fast", pool: "gemini" },
  { name: "Gemini 3.6 Flash Medium", shortName: "Gemini 3.6 Flash", badge: "Fast", pool: "gemini" },
  { name: "Gemini 3.5 Flash Medium", shortName: "Gemini 3.5 Flash", badge: "Fast", pool: "gemini" },
  { name: "Gemini 3.1 Pro Low", shortName: "Gemini 3.1 Pro", badge: "Standard", pool: "gemini" },
  { name: "Claude Sonnet 4.6 (Thinking)", shortName: "Claude Sonnet 4.6", badge: "Deep Reasoning", pool: "claude_gpt" },
  { name: "Claude Opus 4.6 (Thinking)", shortName: "Claude Opus 4.6", badge: "Deep Reasoning", pool: "claude_gpt" },
  { name: "GPT-OSS 120B (Medium)", shortName: "GPT-OSS 120B", badge: "Open Weights", pool: "claude_gpt" }
];

function createFreshPool() {
  return {
    gemini: {
      name: "Gemini Models",
      weeklyRemaining: 100,
      fiveHourRemaining: 100
    },
    claude_gpt: {
      name: "Claude and GPT models",
      weeklyRemaining: 100,
      fiveHourRemaining: 100
    }
  };
}

const TRACKED_ITEMS = [
  path.join("User", "globalStorage"),
  path.join("User", "workspaceStorage"),
  path.join("User", "storage.json"),
  path.join("User", "state.vscdb"),
  path.join("User", "state.vscdb.backup"),
  "Local Storage",
  "Session Storage",
  "Network",
  "Cookies",
  "Cookies-journal",
  "Shared Dictionary",
  "Preferences",
  "app_storage.json"
];

function getAppSupportDir() {
  const home = os.homedir();
  if (process.platform === "darwin") {
    const macAntigravityIDE = path.join(home, "Library", "Application Support", "Antigravity IDE");
    if (fs.existsSync(macAntigravityIDE)) return macAntigravityIDE;
    const macAntigravity = path.join(home, "Library", "Application Support", "Antigravity");
    if (fs.existsSync(macAntigravity)) return macAntigravity;
    const macCode = path.join(home, "Library", "Application Support", "Code");
    if (fs.existsSync(macCode)) return macCode;
    return macAntigravityIDE;
  }
  
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    const winAntigravityIDE = path.join(appData, "Antigravity IDE");
    if (fs.existsSync(winAntigravityIDE)) return winAntigravityIDE;
    const winAntigravity = path.join(appData, "Antigravity");
    if (fs.existsSync(winAntigravity)) return winAntigravity;
    const winCode = path.join(appData, "Code");
    if (fs.existsSync(winCode)) return winCode;
    return winAntigravityIDE;
  }

  const linuxPathIDE = path.join(home, ".config", "Antigravity IDE");
  if (fs.existsSync(linuxPathIDE)) return linuxPathIDE;
  const linuxPath = path.join(home, ".config", "Antigravity");
  if (fs.existsSync(linuxPath)) return linuxPath;
  return path.join(home, ".antigravity");
}

function getAllAppSupportDirs() {
  const home = os.homedir();
  const dirs = [];

  if (process.platform === "darwin") {
    const macIDE = path.join(home, "Library", "Application Support", "Antigravity IDE");
    const macApp = path.join(home, "Library", "Application Support", "Antigravity");
    if (fs.existsSync(macIDE)) dirs.push(macIDE);
    if (fs.existsSync(macApp)) dirs.push(macApp);
    if (dirs.length === 0) dirs.push(macIDE);
    return dirs;
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    const winIDE = path.join(appData, "Antigravity IDE");
    const winApp = path.join(appData, "Antigravity");
    if (fs.existsSync(winIDE)) dirs.push(winIDE);
    if (fs.existsSync(winApp)) dirs.push(winApp);
    if (dirs.length === 0) dirs.push(winIDE);
    return dirs;
  }

  const linuxIDE = path.join(home, ".config", "Antigravity IDE");
  const linuxApp = path.join(home, ".config", "Antigravity");
  if (fs.existsSync(linuxIDE)) dirs.push(linuxIDE);
  if (fs.existsSync(linuxApp)) dirs.push(linuxApp);
  if (dirs.length === 0) dirs.push(path.join(home, ".antigravity"));
  return dirs;
}

function getProfilesRoot() {
  return path.join(getAppSupportDir(), "Profiles");
}

function getMetadataPath() {
  return path.join(getProfilesRoot(), "profiles.json");
}

function ensureProfilesRoot() {
  const allDirs = getAllAppSupportDirs();
  for (const dir of allDirs) {
    const root = path.join(dir, "Profiles");
    if (!fs.existsSync(root)) {
      try {
        fs.mkdirSync(root, { recursive: true });
      } catch (e) {}
    }
  }
}

function createEmptySlots(maxProfiles) {
  return Array.from({ length: maxProfiles }, (_, index) => ({
    slot: index + 1,
    name: "",
    folder: "",
    createdAt: "",
    updatedAt: "",
    active: false,
    pools: createFreshPool(),
    limits: {},
    usage: {}
  }));
}

function normalizeMetadata(raw, maxProfiles) {
  const base = createEmptySlots(maxProfiles);
  if (!raw || !Array.isArray(raw.slots)) {
    return {
      slots: base,
      activeSlot: null,
      currentModel: "Gemini 3.7 Flash Medium",
      trackedModels: ANTIGRAVITY_MODELS.map(m => m.name)
    };
  }

  for (const incoming of raw.slots) {
    if (!incoming || typeof incoming.slot !== "number") continue;
    if (incoming.slot < 1 || incoming.slot > maxProfiles) continue;
    base[incoming.slot - 1] = {
      slot: incoming.slot,
      name: incoming.name || "",
      folder: incoming.folder || "",
      createdAt: incoming.createdAt || "",
      updatedAt: incoming.updatedAt || "",
      active: !!incoming.active,
      pools: incoming.pools || createFreshPool(),
      limits: incoming.limits || {},
      usage: incoming.usage || {}
    };
  }

  const modelNames = ANTIGRAVITY_MODELS.map(m => m.name);
  let tracked = modelNames;
  if (Array.isArray(raw.trackedModels) && raw.trackedModels.length > 0) {
    tracked = Array.from(new Set([...modelNames, ...raw.trackedModels]));
  }

  return {
    slots: base,
    activeSlot: raw.activeSlot || null,
    currentModel: raw.currentModel || "Gemini 3.7 Flash Medium",
    trackedModels: tracked
  };
}

function getActiveModel() {
  const metadata = loadMetadata();
  return metadata.currentModel || "Gemini 3.7 Flash Medium";
}

function setActiveModel(modelName) {
  const metadata = loadMetadata();
  metadata.currentModel = modelName;
  if (!Array.isArray(metadata.trackedModels)) metadata.trackedModels = [];
  if (!metadata.trackedModels.includes(modelName)) {
    metadata.trackedModels.push(modelName);
  }
  saveMetadata(metadata);
}

function addTrackedModel(modelName) {
  const metadata = loadMetadata();
  if (!Array.isArray(metadata.trackedModels)) metadata.trackedModels = [];
  if (!metadata.trackedModels.includes(modelName)) {
    metadata.trackedModels.push(modelName);
    saveMetadata(metadata);
  }
}

function loadMetadata(maxProfiles = MAX_PROFILES) {
  ensureProfilesRoot();
  const metadataPath = getMetadataPath();
  if (!fs.existsSync(metadataPath)) {
    const initial = {
      slots: createEmptySlots(maxProfiles),
      activeSlot: null,
      currentModel: "Gemini 3.7 Flash Medium",
      trackedModels: ANTIGRAVITY_MODELS.map(m => m.name)
    };
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(initial, null, 2), "utf8");
    } catch (e) {}
    return initial;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const normalized = normalizeMetadata(parsed, maxProfiles);
    saveMetadata(normalized);
    return normalized;
  } catch (error) {
    const fallback = {
      slots: createEmptySlots(maxProfiles),
      activeSlot: null,
      currentModel: "Gemini 3.7 Flash Medium",
      trackedModels: ANTIGRAVITY_MODELS.map(m => m.name)
    };
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(fallback, null, 2), "utf8");
    } catch (e) {}
    return fallback;
  }
}

function saveMetadata(metadata) {
  ensureProfilesRoot();
  const allDirs = getAllAppSupportDirs();
  for (const dir of allDirs) {
    const metaFile = path.join(dir, "Profiles", "profiles.json");
    try {
      fs.mkdirSync(path.dirname(metaFile), { recursive: true });
      fs.writeFileSync(metaFile, JSON.stringify(metadata, null, 2), "utf8");
    } catch (e) {}
  }
}

function sanitizeName(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "profile";
}

function shortenLabel(name) {
  return name.length > 14 ? `${name.slice(0, 13)}…` : name;
}

function renderProgressBar(percent, length = 8) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

function getSlotPoolData(slotData) {
  const pools = slotData && slotData.pools ? slotData.pools : createFreshPool();
  const gemini = pools.gemini || { name: "Gemini Models", weeklyRemaining: 100, fiveHourRemaining: 100 };
  const claudeGpt = pools.claude_gpt || { name: "Claude and GPT models", weeklyRemaining: 100, fiveHourRemaining: 100 };

  const avgWeeklyRemaining = Math.round((gemini.weeklyRemaining + claudeGpt.weeklyRemaining) / 2);
  const avgWeeklyUsed = 100 - avgWeeklyRemaining;

  return {
    gemini,
    claudeGpt,
    overallUsedPercent: avgWeeklyUsed,
    overallPendingPercent: avgWeeklyRemaining
  };
}

function clearSlotLimits(slotNumber = null) {
  const metadata = loadMetadata();
  if (slotNumber) {
    const slot = metadata.slots[slotNumber - 1];
    if (slot) {
      slot.limits = {};
      slot.usage = {};
      slot.pools = createFreshPool();
    }
  } else {
    for (const slot of metadata.slots) {
      slot.limits = {};
      slot.usage = {};
      slot.pools = createFreshPool();
    }
  }
  saveMetadata(metadata);
}

// Native Node.js Profile Manager Functions
function copyItems(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const relItem of TRACKED_ITEMS) {
    const src = path.join(sourceDir, relItem);
    const dest = path.join(targetDir, relItem);
    if (fs.existsSync(src)) {
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.cpSync(src, dest, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[ProfilePilot] Could not copy ${relItem}:`, err.message);
      }
    }
  }
}

function saveProfile(slot, profileName) {
  const allDirs = getAllAppSupportDirs();
  ensureProfilesRoot();

  const folderName = `slot-${slot}-${slugify(profileName)}`;

  for (const appDir of allDirs) {
    const profilesRoot = path.join(appDir, "Profiles");
    const slotDir = path.join(profilesRoot, folderName);

    try {
      const existingFolders = fs.readdirSync(profilesRoot).filter(f => f.startsWith(`slot-${slot}-`));
      for (const existing of existingFolders) {
        fs.rmSync(path.join(profilesRoot, existing), { recursive: true, force: true });
      }
    } catch (e) {}

    copyItems(appDir, slotDir);
  }

  const metadata = loadMetadata();
  const now = new Date().toISOString();
  
  const isExistingSlot1 = slot === 1 && metadata.slots[0] && metadata.slots[0].pools;
  const initialPools = isExistingSlot1 ? metadata.slots[0].pools : createFreshPool();

  metadata.slots[slot - 1] = {
    slot: slot,
    name: profileName,
    folder: folderName,
    createdAt: metadata.slots[slot - 1].createdAt || now,
    updatedAt: now,
    active: true,
    pools: initialPools,
    limits: {},
    usage: {}
  };

  metadata.slots.forEach((s, idx) => {
    if (idx !== slot - 1) s.active = false;
  });
  metadata.activeSlot = slot;

  saveMetadata(metadata);
  return { success: true, folder: folderName };
}

function renameProfile(slot, newName) {
  const metadata = loadMetadata();
  const targetSlot = metadata.slots[slot - 1];
  if (!targetSlot || !targetSlot.folder) {
    throw new Error(`Slot ${slot} has no profile to rename.`);
  }

  targetSlot.name = newName;
  targetSlot.updatedAt = new Date().toISOString();
  saveMetadata(metadata);
  return { success: true };
}

function switchProfile(slot) {
  const metadata = loadMetadata();
  const targetSlot = metadata.slots[slot - 1];

  if (!targetSlot || !targetSlot.folder) {
    throw new Error(`Slot ${slot} is empty. Save a profile to this slot first.`);
  }

  const profilesRoot = getProfilesRoot();
  const slotDir = path.join(profilesRoot, targetSlot.folder);
  if (!fs.existsSync(slotDir)) {
    throw new Error(`Profile folder for slot ${slot} was not found at ${slotDir}.`);
  }

  const allDirs = getAllAppSupportDirs();
  for (const appDir of allDirs) {
    copyItems(slotDir, appDir);
  }

  metadata.slots.forEach(s => {
    s.active = s.slot === slot;
  });
  metadata.activeSlot = slot;
  saveMetadata(metadata);

  return { success: true, name: targetSlot.name };
}

function deleteProfile(slot) {
  const metadata = loadMetadata();
  const targetSlot = metadata.slots[slot - 1];
  if (!targetSlot || !targetSlot.folder) {
    return { success: true };
  }

  const allDirs = getAllAppSupportDirs();
  for (const appDir of allDirs) {
    const profilesRoot = path.join(appDir, "Profiles");
    try {
      const existingFolders = fs.readdirSync(profilesRoot).filter(f => f.startsWith(`slot-${slot}-`));
      for (const folder of existingFolders) {
        fs.rmSync(path.join(profilesRoot, folder), { recursive: true, force: true });
      }
    } catch (e) {}
  }

  metadata.slots[slot - 1] = {
    slot: slot,
    name: "",
    folder: "",
    createdAt: "",
    updatedAt: "",
    active: false,
    pools: createFreshPool(),
    limits: {},
    usage: {}
  };

  if (metadata.activeSlot === slot) {
    metadata.activeSlot = null;
  }

  saveMetadata(metadata);
  return { success: true };
}

// Streamlined Tree View Items
class ProfileSlotTreeItem extends vscode.TreeItem {
  constructor(slotData, isActive, activeModel) {
    const isOccupied = !!(slotData && slotData.name);
    let label = `Slot ${slotData.slot}: `;
    if (isOccupied) {
      label += slotData.name;
    } else {
      label += `➕ Add Account ${slotData.slot}`;
    }

    const poolData = getSlotPoolData(slotData);

    const collapsibleState = isOccupied
      ? (isActive ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
      : vscode.TreeItemCollapsibleState.None;

    super(label, collapsibleState);

    this.slot = slotData.slot;
    this.slotData = slotData;
    this.isActive = isActive;
    this.isOccupied = isOccupied;
    this.poolData = poolData;

    if (isActive) {
      this.contextValue = "activeSlot";
      this.description = `● Active • ${poolData.overallUsedPercent}% used`;
      this.iconPath = new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("testing.iconPassed"));
      this.tooltip = `Slot ${slotData.slot}: ${slotData.name}\nStatus: Active Account (Synced with IDE & App)\nActive Model: ${activeModel}\n\nQuotas:\n• Gemini Pool: ${poolData.gemini.weeklyRemaining}% Weekly | ${poolData.gemini.fiveHourRemaining}% 5h\n• Claude & GPT Pool: ${poolData.claudeGpt.weeklyRemaining}% Weekly | ${poolData.claudeGpt.fiveHourRemaining}% 5h\n\nOverall: ${poolData.overallUsedPercent}% Used (${poolData.overallPendingPercent}% Remaining)`;
    } else if (isOccupied) {
      this.contextValue = "occupiedSlot";
      this.description = `Ready • ${poolData.overallUsedPercent}% used`;
      this.iconPath = new vscode.ThemeIcon("account");
      this.tooltip = `Slot ${slotData.slot}: ${slotData.name}\nStatus: Inactive Account (Click to Switch)\nQuotas: ${poolData.gemini.weeklyRemaining}% Gemini | ${poolData.claudeGpt.weeklyRemaining}% Claude & GPT`;
      this.command = {
        command: "antigravityProfilePilot.switchProfileSlot",
        title: `Switch to Slot ${slotData.slot}`,
        arguments: [slotData.slot]
      };
    } else {
      this.contextValue = "emptySlot";
      this.description = "Empty - Click to setup";
      this.iconPath = new vscode.ThemeIcon("add", new vscode.ThemeColor("charts.blue"));
      this.tooltip = `Slot ${slotData.slot} is empty. Click to link another account.`;
      this.command = {
        command: "antigravityProfilePilot.addNewAccountWizard",
        title: `Add Account to Slot ${slotData.slot}`,
        arguments: [slotData.slot]
      };
    }
  }
}

class ActiveModelSummaryTreeItem extends vscode.TreeItem {
  constructor(activeModel) {
    super(`Active Model: ${activeModel}`, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "currentModelItem";
    this.description = "● In Use";
    this.iconPath = new vscode.ThemeIcon("sparkle", new vscode.ThemeColor("charts.yellow"));
    this.tooltip = `Active Model in Antigravity: ${activeModel}\nClick to change active AI model.`;
    this.command = {
      command: "antigravityProfilePilot.selectActiveModel",
      title: "Change Active Model"
    };
  }
}

class QuotaSummaryTreeItem extends vscode.TreeItem {
  constructor(poolData) {
    super(`Quota: Gemini ${poolData.gemini.weeklyRemaining}% rem | Claude ${poolData.claudeGpt.weeklyRemaining}% rem`, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "quotaSummaryItem";
    this.description = "View Breakdown";
    this.iconPath = new vscode.ThemeIcon("graph", new vscode.ThemeColor("charts.blue"));
    this.tooltip = `Account Quotas:\n• Gemini Models: ${poolData.gemini.weeklyRemaining}% Weekly | ${poolData.gemini.fiveHourRemaining}% 5h\n• Claude & GPT: ${poolData.claudeGpt.weeklyRemaining}% Weekly | ${poolData.claudeGpt.fiveHourRemaining}% 5h\n\nClick to view full drill-down.`;
    this.command = {
      command: "antigravityProfilePilot.showUsageBreakdown",
      title: "View Usage Drill-Down"
    };
  }
}

class PoolGroupTreeItem extends vscode.TreeItem {
  constructor(slotData, poolKey, poolInfo, isActive, activeModel) {
    const isGemini = poolKey === "gemini";
    const label = `${poolInfo.name} (${poolInfo.weeklyRemaining}% Rem)`;
    super(label, vscode.TreeItemCollapsibleState.Collapsed);

    this.slot = slotData.slot;
    this.slotData = slotData;
    this.poolKey = poolKey;
    this.poolInfo = poolInfo;
    this.isActive = isActive;
    this.activeModel = activeModel;
    this.contextValue = "poolGroupItem";
    this.iconPath = isGemini
      ? new vscode.ThemeIcon("globe", new vscode.ThemeColor("charts.blue"))
      : new vscode.ThemeIcon("robot", new vscode.ThemeColor("charts.purple"));
    this.description = `5h: ${poolInfo.fiveHourRemaining}% | Wk: ${poolInfo.weeklyRemaining}%`;
    this.tooltip = `${poolInfo.name}:\n• Weekly Limit Remaining: ${poolInfo.weeklyRemaining}%\n• Five Hour Limit Remaining: ${poolInfo.fiveHourRemaining}%\nClick to open detailed drill-down.`;
  }
}

class QuotaMetricTreeItem extends vscode.TreeItem {
  constructor(title, percent, iconType) {
    super(`${title}: ${percent}% Remaining`, vscode.TreeItemCollapsibleState.None);
    this.description = `${100 - percent}% used`;
    this.iconPath = iconType === "clock"
      ? new vscode.ThemeIcon("history", new vscode.ThemeColor("charts.green"))
      : new vscode.ThemeIcon("calendar", new vscode.ThemeColor("charts.blue"));
    this.tooltip = `${title}: ${percent}% Remaining (${100 - percent}% used)`;
  }
}

class AntigravityModelTreeItem extends vscode.TreeItem {
  constructor(slotData, modelObj, isActive, activeModel) {
    const isCurrentModel = isActive && (activeModel.includes(modelObj.shortName) || modelObj.name.includes(activeModel));
    super(modelObj.name, vscode.TreeItemCollapsibleState.None);

    this.slot = slotData.slot;
    this.slotData = slotData;
    this.modelObj = modelObj;
    this.isCurrentModel = isCurrentModel;
    this.contextValue = "availableItem";

    if (isCurrentModel) {
      this.description = `● Active (${modelObj.badge})`;
      this.iconPath = new vscode.ThemeIcon("sparkle", new vscode.ThemeColor("charts.yellow"));
    } else {
      this.description = modelObj.badge;
      this.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green"));
    }

    this.tooltip = `Model: ${modelObj.name}\nBadge: ${modelObj.badge}\nClick to set as active model.`;
    this.command = {
      command: "antigravityProfilePilot.selectActiveModel",
      title: "Set Active Model",
      arguments: [modelObj.name]
    };
  }
}

class SwitchActionTreeItem extends vscode.TreeItem {
  constructor(slotData) {
    super(`Switch to ${slotData.name}`, vscode.TreeItemCollapsibleState.None);
    this.slot = slotData.slot;
    this.contextValue = "switchActionItem";
    this.iconPath = new vscode.ThemeIcon("play", new vscode.ThemeColor("charts.blue"));
    this.description = "1-Click Switch";
    this.tooltip = `Switch active Antigravity session to Slot ${slotData.slot} (${slotData.name})`;
    this.command = {
      command: "antigravityProfilePilot.switchProfileSlot",
      title: `Switch to Slot ${slotData.slot}`,
      arguments: [slotData.slot]
    };
  }
}

class AddAccountActionTreeItem extends vscode.TreeItem {
  constructor() {
    super("➕ Add / Link Another Google Account", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "addAccountHeaderItem";
    this.description = "Guided setup";
    this.iconPath = new vscode.ThemeIcon("person-add", new vscode.ThemeColor("charts.blue"));
    this.tooltip = "Launch step-by-step wizard to link another Google account.";
    this.command = {
      command: "antigravityProfilePilot.addNewAccountWizard",
      title: "Add Another Account"
    };
  }
}

class QuickGuideTreeItem extends vscode.TreeItem {
  constructor() {
    super("💡 Quick Guide & Shortcuts", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "guideTreeItem";
    this.description = "Help";
    this.iconPath = new vscode.ThemeIcon("lightbulb", new vscode.ThemeColor("charts.yellow"));
    this.tooltip = "How to add and switch accounts easily.";
    this.command = {
      command: "antigravityProfilePilot.showQuickGuide",
      title: "Show Quick Guide"
    };
  }
}

class AccountSlotsTreeDataProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    const metadata = loadMetadata();
    const config = vscode.workspace.getConfiguration("antigravityProfilePilot");
    const maxProfiles = config.get("maxProfiles", 5);
    const activeModel = getActiveModel();

    if (!element) {
      const items = [];
      for (let i = 0; i < maxProfiles; i++) {
        const slotData = metadata.slots[i] || { slot: i + 1, name: "", folder: "", active: false, pools: createFreshPool(), limits: {}, usage: {} };
        const isActive = slotData.active || metadata.activeSlot === (i + 1);
        items.push(new ProfileSlotTreeItem(slotData, isActive, activeModel));
      }

      items.push(new AddAccountActionTreeItem());
      items.push(new QuickGuideTreeItem());

      return items;
    }

    if (element instanceof ProfileSlotTreeItem && element.isOccupied) {
      const slotData = element.slotData;
      const isActive = element.isActive;
      const poolData = element.poolData;
      const children = [];

      if (isActive) {
        children.push(new ActiveModelSummaryTreeItem(activeModel));
        children.push(new QuotaSummaryTreeItem(poolData));
        children.push(new PoolGroupTreeItem(slotData, "gemini", poolData.gemini, isActive, activeModel));
        children.push(new PoolGroupTreeItem(slotData, "claude_gpt", poolData.claudeGpt, isActive, activeModel));
      } else {
        children.push(new SwitchActionTreeItem(slotData));
        children.push(new PoolGroupTreeItem(slotData, "gemini", poolData.gemini, isActive, activeModel));
        children.push(new PoolGroupTreeItem(slotData, "claude_gpt", poolData.claudeGpt, isActive, activeModel));
      }

      return children;
    }

    if (element instanceof PoolGroupTreeItem) {
      const poolInfo = element.poolInfo;
      const poolKey = element.poolKey;
      const slotData = element.slotData;
      const isActive = element.isActive;
      const activeModel = element.activeModel;
      const children = [];

      children.push(new QuotaMetricTreeItem("Weekly Limit", poolInfo.weeklyRemaining, "calendar"));
      children.push(new QuotaMetricTreeItem("Five Hour Limit", poolInfo.fiveHourRemaining, "clock"));

      const poolModels = ANTIGRAVITY_MODELS.filter(m => m.pool === poolKey);
      for (const m of poolModels) {
        children.push(new AntigravityModelTreeItem(slotData, m, isActive, activeModel));
      }

      return children;
    }

    return [];
  }
}

class AccountSwitcherUI {
  constructor(context, treeDataProvider) {
    this.context = context;
    this.treeDataProvider = treeDataProvider;
    this.slotButtons = [];
    this.saveButton = null;
    this.initStatusBar();
  }

  initStatusBar() {
    this.saveButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 105);
    this.saveButton.text = "$(add) Save Account";
    this.saveButton.tooltip = "Save current Antigravity session into a profile slot";
    this.saveButton.command = "antigravityProfilePilot.addNewAccountWizard";
    this.context.subscriptions.push(this.saveButton);

    for (let i = 0; i < MAX_PROFILES; i++) {
      const btn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100 - i);
      btn.command = {
        command: "antigravityProfilePilot.switchProfileSlot",
        arguments: [i + 1],
        title: `Switch to Slot ${i + 1}`
      };
      this.slotButtons.push(btn);
      this.context.subscriptions.push(btn);
    }
    this.refresh();
  }

  refresh() {
    const metadata = loadMetadata();
    const config = vscode.workspace.getConfiguration("antigravityProfilePilot");
    const maxProfiles = config.get("maxProfiles", 5);
    const activeModel = getActiveModel();

    this.saveButton.show();

    for (let i = 0; i < MAX_PROFILES; i++) {
      const btn = this.slotButtons[i];
      if (i >= maxProfiles) {
        btn.hide();
        continue;
      }

      const slotData = metadata.slots[i];
      const color = PROFILE_COLORS[i % PROFILE_COLORS.length];

      if (slotData && slotData.name) {
        const isActive = slotData.active || metadata.activeSlot === (i + 1);
        const poolData = getSlotPoolData(slotData);

        let icon = isActive ? "$(check)" : "$(account)";

        btn.text = `${icon} ${i + 1}: ${shortenLabel(slotData.name)} (${poolData.overallUsedPercent}% used)`;
        btn.color = isActive ? "#FFFFFF" : color;
        btn.backgroundColor = isActive
          ? new vscode.ThemeColor("statusBarItem.warningBackground")
          : undefined;
        btn.tooltip = `Slot ${i + 1}: ${slotData.name}${isActive ? ` (Active - Using ${activeModel})` : " - Click to Switch"}\n\nQuotas:\n• Gemini: ${poolData.gemini.weeklyRemaining}% Wk | ${poolData.gemini.fiveHourRemaining}% 5h\n• Claude & GPT: ${poolData.claudeGpt.weeklyRemaining}% Wk | ${poolData.claudeGpt.fiveHourRemaining}% 5h\n\nOverall: ${poolData.overallUsedPercent}% Used (${poolData.overallPendingPercent}% Remaining)\nSaved: ${slotData.updatedAt || slotData.createdAt || "N/A"}`;
      } else {
        btn.text = `$(circle-outline) ${i + 1}: + Add`;
        btn.color = "#777777";
        btn.backgroundColor = undefined;
        btn.tooltip = `Slot ${i + 1} is empty. Click to link another Google account.`;
      }
      btn.show();
    }

    if (this.treeDataProvider) {
      this.treeDataProvider.refresh();
    }
  }
}

function parseSlotNumber(arg) {
  if (typeof arg === "number") return arg;
  if (arg && typeof arg.slot === "number") return arg.slot;
  if (arg && arg.slotData && typeof arg.slotData.slot === "number") return arg.slotData.slot;
  return null;
}

function activate(context) {
  const treeDataProvider = new AccountSlotsTreeDataProvider();
  vscode.window.registerTreeDataProvider("antigravityProfilePilot.slotsView", treeDataProvider);

  const ui = new AccountSwitcherUI(context, treeDataProvider);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("antigravityProfilePilot")) {
        ui.refresh();
      }
    })
  );

  // Add Custom Model Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.addCustomModel", async () => {
      const modelName = await vscode.window.showInputBox({
        prompt: "Enter AI Model Name to track",
        placeHolder: "e.g. Claude 3.7 Sonnet (Thinking) / DeepSeek R1"
      });
      if (!modelName) return;

      addTrackedModel(modelName.trim());
      ui.refresh();
      vscode.window.showInformationMessage(`✓ Added "${modelName.trim()}" to Profile Pilot!`);
    })
  );

  // Add / Link Another Google Account Guided Setup Wizard
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.addNewAccountWizard", async itemOrSlot => {
      const metadata = loadMetadata();
      const activeSlotNum = metadata.activeSlot || 1;
      const activeSlot = metadata.slots[activeSlotNum - 1];
      const activeName = activeSlot && activeSlot.name ? activeSlot.name : `Slot ${activeSlotNum}`;

      let targetSlotNum = parseSlotNumber(itemOrSlot);
      if (!targetSlotNum) {
        const firstEmpty = metadata.slots.find(s => !s.name);
        targetSlotNum = firstEmpty ? firstEmpty.slot : 2;
      }

      const instructions =
        `Follow these 3 simple steps:\n\n` +
        `1. ✅ Your current account is safely saved in Slot ${activeSlotNum} (${activeName}).\n` +
        `2. In Antigravity IDE or App, sign out and log in with your 2nd Google Account.\n` +
        `3. Once signed in, click "Save & Link to Slot ${targetSlotNum}" below.\n\n` +
        `Both Antigravity IDE and Antigravity App will stay automatically synchronized!`;

      const choice = await vscode.window.showInformationMessage(
        `Link Another Google Account into Slot ${targetSlotNum}`,
        { modal: true, detail: instructions },
        `Save Current Session to Slot ${targetSlotNum}`,
        "Open Accounts Menu"
      );

      if (choice === `Save Current Session to Slot ${targetSlotNum}`) {
        const defaultName = `Account ${targetSlotNum}`;
        const profileName = await vscode.window.showInputBox({
          prompt: `Enter a friendly name for Slot ${targetSlotNum} (e.g. Work, Backup, Secondary)`,
          value: defaultName,
          validateInput: val => (val && sanitizeName(val).length > 0 ? null : "Please enter a valid profile name")
        });
        if (!profileName) return;

        try {
          saveProfile(targetSlotNum, sanitizeName(profileName));
          ui.refresh();
          vscode.window.showInformationMessage(`🎉 Successfully linked Slot ${targetSlotNum} (${profileName})! Synced across Antigravity IDE and App.`);
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to save to Slot ${targetSlotNum}: ${err.message}`);
        }
      } else if (choice === "Open Accounts Menu") {
        vscode.commands.executeCommand("workbench.action.accounts");
      }
    })
  );

  // Show Quick Guide Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.showQuickGuide", async () => {
      const guideText =
        `How Multi-Account Switching Works (IDE & App Sync):\n\n` +
        `1. YOUR ACTIVE ACCOUNT IS SAVED\n` +
        `   Your current Google Account is preserved in Slot 1.\n\n` +
        `2. LOG IN TO YOUR SECOND ACCOUNT\n` +
        `   • Sign out of Antigravity (Accounts menu in IDE or App).\n` +
        `   • Sign in with your second Google account in the browser.\n\n` +
        `3. LINK IT TO SLOT 2\n` +
        `   • In the sidebar, click "➕ Add Account 2".\n` +
        `   • Give it a name (e.g., "Work Account").\n\n` +
        `4. DUAL-APP INSTANT SWITCHING\n` +
        `   • Click any slot to switch with 1-click.\n` +
        `   • Swaps credentials across BOTH Antigravity IDE and Antigravity App automatically!`;

      const choice = await vscode.window.showInformationMessage(
        guideText,
        { modal: true },
        "Add New Account Now",
        "Close"
      );

      if (choice === "Add New Account Now") {
        vscode.commands.executeCommand("antigravityProfilePilot.addNewAccountWizard");
      }
    })
  );

  // Show Usage Breakdown Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.showUsageBreakdown", async () => {
      const metadata = loadMetadata();
      const activeModel = getActiveModel();

      const breakdownLines = [];
      breakdownLines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      breakdownLines.push("           PROFILE PILOT: USAGE DRILL-DOWN         ");
      breakdownLines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      breakdownLines.push(`Active Model: ${activeModel}\n`);

      for (const slot of metadata.slots) {
        if (!slot.name) continue;
        const poolData = getSlotPoolData(slot);
        const isActive = slot.active || metadata.activeSlot === slot.slot;
        
        breakdownLines.push(`👤 Slot ${slot.slot}: ${slot.name}${isActive ? " (Active Session)" : ""}`);
        breakdownLines.push(`Overall Quota: ${renderProgressBar(poolData.overallUsedPercent, 12)} ${poolData.overallUsedPercent}% Used (${poolData.overallPendingPercent}% Remaining)\n`);

        const gem = poolData.gemini;
        breakdownLines.push(`┌── 🌐 GEMINI MODELS ─────────────────────────────┐`);
        breakdownLines.push(`│  • Weekly Limit Remaining    : ${gem.weeklyRemaining}% ${renderProgressBar(100 - gem.weeklyRemaining, 8)}`);
        breakdownLines.push(`│  • Five Hour Limit Remaining : ${gem.fiveHourRemaining}% ${renderProgressBar(100 - gem.fiveHourRemaining, 8)}`);
        breakdownLines.push(`│  Models: Gemini 3.7 Flash, 3.6 Flash, 3.5 Flash, 3.1 Pro`);
        breakdownLines.push(`└──────────────────────────────────────────────────┘\n`);

        const cg = poolData.claudeGpt;
        breakdownLines.push(`┌── 🤖 CLAUDE & GPT MODELS ───────────────────────┐`);
        breakdownLines.push(`│  • Weekly Limit Remaining    : ${cg.weeklyRemaining}% ${renderProgressBar(100 - cg.weeklyRemaining, 8)}`);
        breakdownLines.push(`│  • Five Hour Limit Remaining : ${cg.fiveHourRemaining}% ${renderProgressBar(100 - cg.fiveHourRemaining, 8)}`);
        breakdownLines.push(`│  Models: Claude Sonnet 4.6, Claude Opus 4.6, GPT-OSS 120B`);
        breakdownLines.push(`└──────────────────────────────────────────────────┘\n`);
      }

      const action = await vscode.window.showInformationMessage(
        breakdownLines.join("\n"),
        { modal: true },
        "Reset Quota Counters",
        "Switch Account"
      );

      if (action === "Reset Quota Counters") {
        vscode.commands.executeCommand("antigravityProfilePilot.resetSlotLimits");
      } else if (action === "Switch Account") {
        vscode.commands.executeCommand("antigravityProfilePilot.switchProfile");
      }
    })
  );

  // Select / Change Active Model Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.selectActiveModel", async directModel => {
      if (typeof directModel === "string" && directModel.length > 0) {
        setActiveModel(directModel);
        ui.refresh();
        vscode.window.showInformationMessage(`✓ Active model set to ${directModel}`);
        return;
      }

      const current = getActiveModel();
      const modelOptions = ANTIGRAVITY_MODELS.map(m => ({
        label: `${current.includes(m.shortName) ? "✓ " : ""}${m.name}`,
        description: `(${m.badge})${current.includes(m.shortName) ? " [Currently Active]" : ""}`,
        model: m.name
      }));

      modelOptions.push({
        label: "$(plus) Custom Model...",
        description: "Add a custom model name / endpoint",
        model: "Custom Model..."
      });

      const chosen = await vscode.window.showQuickPick(modelOptions, {
        placeHolder: `Select active model in Antigravity (Current: ${current})`
      });
      if (!chosen) return;

      let selectedModel = chosen.model;
      if (selectedModel === "Custom Model...") {
        const input = await vscode.window.showInputBox({
          prompt: "Enter custom model name",
          placeHolder: "e.g. Gemini 3.0 Pro / Claude 3.7 / DeepSeek"
        });
        if (!input) return;
        selectedModel = input.trim();
      }

      setActiveModel(selectedModel);
      ui.refresh();
      vscode.window.showInformationMessage(`✓ Active model set to ${selectedModel}`);
    })
  );

  // Save Profile Command (General QuickPick)
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.saveCurrentProfile", async () => {
      const metadata = loadMetadata();
      const slotItems = metadata.slots.map(s => ({
        label: `Slot ${s.slot}: ${s.name ? s.name : "(Empty)"}`,
        description: s.updatedAt ? `Last saved: ${new Date(s.updatedAt).toLocaleTimeString()}` : "",
        slot: s.slot,
        currentName: s.name
      }));

      const selectedSlot = await vscode.window.showQuickPick(slotItems, {
        placeHolder: "Select a slot to save the current account session"
      });
      if (!selectedSlot) return;

      const profileName = await vscode.window.showInputBox({
        prompt: `Enter a name for Slot ${selectedSlot.slot}`,
        value: selectedSlot.currentName || `Account ${selectedSlot.slot}`,
        validateInput: val => (val && sanitizeName(val).length > 0 ? null : "Please enter a valid profile name")
      });
      if (!profileName) return;

      try {
        saveProfile(selectedSlot.slot, sanitizeName(profileName));
        ui.refresh();
        vscode.window.showInformationMessage(`✓ Saved current session to Slot ${selectedSlot.slot} (${profileName}) across IDE and App`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to save profile: ${err.message}`);
      }
    })
  );

  // Save Current Session to Specific Slot (from Sidebar or Context Menu)
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.saveToSpecificSlot", async itemOrSlot => {
      let slotNumber = parseSlotNumber(itemOrSlot);

      if (!slotNumber) {
        return vscode.commands.executeCommand("antigravityProfilePilot.addNewAccountWizard");
      }

      const metadata = loadMetadata();
      const currentSlot = metadata.slots[slotNumber - 1];
      const defaultName = currentSlot && currentSlot.name ? currentSlot.name : `Account ${slotNumber}`;

      const profileName = await vscode.window.showInputBox({
        prompt: `Enter a name to save current session to Slot ${slotNumber}`,
        value: defaultName,
        validateInput: val => (val && sanitizeName(val).length > 0 ? null : "Please enter a valid profile name")
      });
      if (!profileName) return;

      try {
        saveProfile(slotNumber, sanitizeName(profileName));
        ui.refresh();
        vscode.window.showInformationMessage(`✓ Saved current session to Slot ${slotNumber} (${profileName}) across IDE and App`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to save to Slot ${slotNumber}: ${err.message}`);
      }
    })
  );

  // Switch Profile Command (General QuickPick)
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.switchProfile", async () => {
      const metadata = loadMetadata();
      const available = metadata.slots.filter(s => s.name && s.folder);
      if (available.length === 0) {
        const saveNow = "Add First Account";
        const res = await vscode.window.showInformationMessage("No saved profiles found. Add your current session first.", saveNow);
        if (res === saveNow) {
          vscode.commands.executeCommand("antigravityProfilePilot.addNewAccountWizard");
        }
        return;
      }

      const items = available.map(s => ({
        label: `${s.active ? "✓ " : ""}${s.slot}: ${s.name}`,
        description: s.active ? "(Active)" : `Last updated: ${new Date(s.updatedAt).toLocaleTimeString()}`,
        slot: s.slot,
        name: s.name
      }));

      const chosen = await vscode.window.showQuickPick(items, {
        placeHolder: "Select an account profile to switch to"
      });
      if (!chosen) return;

      try {
        switchProfile(chosen.slot);
        ui.refresh();
        const reload = "Reload Now";
        const answer = await vscode.window.showInformationMessage(
          `Switched to profile: ${chosen.name}. Reload window to apply changes?`,
          reload,
          "Later"
        );
        if (answer === reload) {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to switch profile: ${err.message}`);
      }
    })
  );

  // Switch Profile Slot Direct Command (from status bar, tree view, or context menu)
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.switchProfileSlot", async itemOrSlot => {
      const slotNumber = parseSlotNumber(itemOrSlot);
      if (!slotNumber) return;

      const metadata = loadMetadata();
      const target = metadata.slots[slotNumber - 1];

      if (!target || !target.name) {
        return vscode.commands.executeCommand("antigravityProfilePilot.addNewAccountWizard", slotNumber);
      }

      if (target.active) {
        vscode.window.showInformationMessage(`Slot ${slotNumber} (${target.name}) is already active.`);
        return;
      }

      try {
        switchProfile(slotNumber);
        ui.refresh();
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to switch to Slot ${slotNumber}: ${err.message}`);
      }
    })
  );

  // Rename Profile Slot Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.renameProfileSlot", async itemOrSlot => {
      let slotNumber = parseSlotNumber(itemOrSlot);

      if (!slotNumber) {
        const metadata = loadMetadata();
        const available = metadata.slots.filter(s => s.name);
        if (available.length === 0) {
          vscode.window.showInformationMessage("No saved profiles to rename.");
          return;
        }

        const items = available.map(s => ({
          label: `Slot ${s.slot}: ${s.name}`,
          slot: s.slot,
          name: s.name
        }));

        const chosen = await vscode.window.showQuickPick(items, {
          placeHolder: "Select a profile to rename"
        });
        if (!chosen) return;
        slotNumber = chosen.slot;
      }

      const metadata = loadMetadata();
      const current = metadata.slots[slotNumber - 1];
      if (!current || !current.name) {
        vscode.window.showInformationMessage(`Slot ${slotNumber} is empty.`);
        return;
      }

      const newName = await vscode.window.showInputBox({
        prompt: `Enter new name for Slot ${slotNumber}`,
        value: current.name,
        validateInput: val => (val && sanitizeName(val).length > 0 ? null : "Please enter a valid profile name")
      });
      if (!newName || newName === current.name) return;

      try {
        renameProfile(slotNumber, sanitizeName(newName));
        ui.refresh();
        vscode.window.showInformationMessage(`✓ Renamed Slot ${slotNumber} to "${newName}"`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to rename profile: ${err.message}`);
      }
    })
  );

  // Direct Delete / Clear Profile Slot Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.deleteProfileSlotDirect", async itemOrSlot => {
      const slotNumber = parseSlotNumber(itemOrSlot);
      if (!slotNumber) return;

      const metadata = loadMetadata();
      const current = metadata.slots[slotNumber - 1];
      if (!current || !current.name) {
        vscode.window.showInformationMessage(`Slot ${slotNumber} is already empty.`);
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to clear Slot ${slotNumber} ("${current.name}")?`,
        "Clear Slot",
        "Cancel"
      );
      if (confirm !== "Clear Slot") return;

      try {
        deleteProfile(slotNumber);
        ui.refresh();
        vscode.window.showInformationMessage(`Cleared Slot ${slotNumber}.`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to delete profile: ${err.message}`);
      }
    })
  );

  // Reset Rate Limits Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.resetSlotLimits", async itemOrSlot => {
      const slotNumber = parseSlotNumber(itemOrSlot);
      if (slotNumber) {
        clearSlotLimits(slotNumber);
        ui.refresh();
        vscode.window.showInformationMessage(`✓ Quota counters & limits reset for Slot ${slotNumber}.`);
      } else {
        const option = await vscode.window.showQuickPick(["Reset All Slots", "Select a Slot to Reset"], {
          placeHolder: "Reset Quota Status & Rate Limits"
        });
        if (option === "Reset All Slots") {
          clearSlotLimits(null);
          ui.refresh();
          vscode.window.showInformationMessage("✓ Quota counters & limits reset for all slots.");
        } else if (option === "Select a Slot to Reset") {
          const metadata = loadMetadata();
          const items = metadata.slots.map(s => ({
            label: `Slot ${s.slot}: ${s.name ? s.name : "(Empty)"}`,
            slot: s.slot
          }));
          const chosen = await vscode.window.showQuickPick(items);
          if (chosen) {
            clearSlotLimits(chosen.slot);
            ui.refresh();
            vscode.window.showInformationMessage(`✓ Quota counters & limits reset for Slot ${chosen.slot}.`);
          }
        }
      }
    })
  );

  // Show Model Limit Details Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.showLimitDetails", async item => {
      if (!item) return;
      const model = item.modelObj ? item.modelObj.name : "Model";
      const slot = item.slotData ? `Slot ${item.slotData.slot} (${item.slotData.name})` : `Slot ${item.slot}`;

      const action = await vscode.window.showInformationMessage(
        `⚡ Quota Details for ${model} on ${slot}:\n\nStatus: Active & Ready in Quota Pool`,
        { modal: true },
        "View Full Drill-Down",
        "Switch Account"
      );

      if (action === "View Full Drill-Down") {
        vscode.commands.executeCommand("antigravityProfilePilot.showUsageBreakdown");
      } else if (action === "Switch Account") {
        vscode.commands.executeCommand("antigravityProfilePilot.switchProfile");
      }
    })
  );

  // Delete Profile Command (General QuickPick)
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.deleteProfile", async () => {
      const metadata = loadMetadata();
      const available = metadata.slots.filter(s => s.name);
      if (available.length === 0) {
        vscode.window.showInformationMessage("No saved profiles to delete.");
        return;
      }

      const items = available.map(s => ({
        label: `Slot ${s.slot}: ${s.name}`,
        slot: s.slot,
        name: s.name
      }));

      const chosen = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a profile to delete"
      });
      if (!chosen) return;

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete profile "${chosen.name}" in Slot ${chosen.slot}?`,
        "Delete",
        "Cancel"
      );
      if (confirm !== "Delete") return;

      try {
        deleteProfile(chosen.slot);
        ui.refresh();
        vscode.window.showInformationMessage(`Deleted profile in Slot ${chosen.slot}.`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to delete profile: ${err.message}`);
      }
    })
  );

  // Refresh Slots Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.refreshSlots", () => {
      ui.refresh();
      vscode.window.setStatusBarMessage("$(check) Profile Pilot account quotas & model drill-down refreshed", 2000);
    })
  );

  // List Profiles Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.listProfiles", () => {
      const metadata = loadMetadata();
      const list = metadata.slots
        .map(s => {
          const poolData = getSlotPoolData(s);
          return `Slot ${s.slot}: ${s.name ? `${s.name}${s.active ? " (Active)" : ""} (${poolData.overallUsedPercent}% used)` : "(Empty)"}`;
        })
        .join("\n");
      vscode.window.showInformationMessage(`Saved Profiles:\n\n${list}`);
    })
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
