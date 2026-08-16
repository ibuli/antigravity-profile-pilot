const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PROFILE_COLORS = ["#4A90E2", "#28A745", "#F39C12", "#8E44AD", "#E84393"];
const MAX_PROFILES = 5;

const RATE_LIMIT_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /\b429\b/,
  /quota exceeded/i,
  /resource exhausted/i,
  /anthropic.*rate/i,
  /claude.*rate/i,
  /gemini.*rate/i,
  /usage limit/i
];

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
    const macAntigravity = path.join(home, "Library", "Application Support", "Antigravity");
    if (fs.existsSync(macAntigravity)) return macAntigravity;
    const macCode = path.join(home, "Library", "Application Support", "Code");
    if (fs.existsSync(macCode)) return macCode;
    return macAntigravity;
  }
  
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(appData, "Antigravity");
  }

  // Linux / Other
  const linuxPath = path.join(home, ".config", "Antigravity");
  if (fs.existsSync(linuxPath)) return linuxPath;
  return path.join(home, ".antigravity");
}

function getProfilesRoot() {
  return path.join(getAppSupportDir(), "Profiles");
}

function getMetadataPath() {
  return path.join(getProfilesRoot(), "profiles.json");
}

function ensureProfilesRoot() {
  const root = getProfilesRoot();
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
}

function createEmptySlots(maxProfiles) {
  return Array.from({ length: maxProfiles }, (_, index) => ({
    slot: index + 1,
    name: "",
    folder: "",
    createdAt: "",
    updatedAt: "",
    active: false
  }));
}

function normalizeMetadata(raw, maxProfiles) {
  const base = createEmptySlots(maxProfiles);
  if (!raw || !Array.isArray(raw.slots)) {
    return { slots: base, activeSlot: null };
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
      active: !!incoming.active
    };
  }

  return { slots: base, activeSlot: raw.activeSlot || null };
}

function loadMetadata(maxProfiles = MAX_PROFILES) {
  ensureProfilesRoot();
  const metadataPath = getMetadataPath();
  if (!fs.existsSync(metadataPath)) {
    const initial = { slots: createEmptySlots(maxProfiles), activeSlot: null };
    fs.writeFileSync(metadataPath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const normalized = normalizeMetadata(parsed, maxProfiles);
    saveMetadata(normalized);
    return normalized;
  } catch (error) {
    const fallback = { slots: createEmptySlots(maxProfiles), activeSlot: null };
    fs.writeFileSync(metadataPath, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

function saveMetadata(metadata) {
  ensureProfilesRoot();
  fs.writeFileSync(getMetadataPath(), JSON.stringify(metadata, null, 2), "utf8");
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
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
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
        console.warn(`[AccountSwitcher] Could not copy ${relItem}:`, err.message);
      }
    }
  }
}

function saveProfile(slot, profileName) {
  const appRoot = getAppSupportDir();
  const profilesRoot = getProfilesRoot();
  ensureProfilesRoot();

  const folderName = `slot-${slot}-${slugify(profileName)}`;
  const slotDir = path.join(profilesRoot, folderName);

  // Clean old slot folder if exists
  const existingFolders = fs.readdirSync(profilesRoot).filter(f => f.startsWith(`slot-${slot}-`));
  for (const existing of existingFolders) {
    try {
      fs.rmSync(path.join(profilesRoot, existing), { recursive: true, force: true });
    } catch (e) {}
  }

  // Copy current session into slot
  copyItems(appRoot, slotDir);

  // Update metadata
  const metadata = loadMetadata();
  const now = new Date().toISOString();
  metadata.slots[slot - 1] = {
    slot: slot,
    name: profileName,
    folder: folderName,
    createdAt: metadata.slots[slot - 1].createdAt || now,
    updatedAt: now,
    active: true
  };

  metadata.slots.forEach((s, idx) => {
    if (idx !== slot - 1) s.active = false;
  });
  metadata.activeSlot = slot;

  saveMetadata(metadata);
  return { success: true, folder: folderName };
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

  const appRoot = getAppSupportDir();
  copyItems(slotDir, appRoot);

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

  const profilesRoot = getProfilesRoot();
  const existingFolders = fs.readdirSync(profilesRoot).filter(f => f.startsWith(`slot-${slot}-`));
  for (const folder of existingFolders) {
    try {
      fs.rmSync(path.join(profilesRoot, folder), { recursive: true, force: true });
    } catch (e) {}
  }

  metadata.slots[slot - 1] = {
    slot: slot,
    name: "",
    folder: "",
    createdAt: "",
    updatedAt: "",
    active: false
  };

  if (metadata.activeSlot === slot) {
    metadata.activeSlot = null;
  }

  saveMetadata(metadata);
  return { success: true };
}

class RateLimitMonitor {
  constructor(context, onDetect) {
    this.context = context;
    this.onDetect = onDetect;
    this.interval = undefined;
    this.lastAlertAt = 0;
    this.fileOffsets = new Map();
  }

  start() {
    this.stop();
    const config = vscode.workspace.getConfiguration("antigravityAccountSwitcher");
    if (!config.get("rateLimitMonitor.enabled", true)) return;

    const seconds = config.get("rateLimitMonitor.scanIntervalSeconds", 15);
    this.interval = setInterval(() => {
      this.scan().catch(() => {});
    }, seconds * 1000);
    this.scan().catch(() => {});
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  getLogDirectories() {
    const dirs = [];
    const appDir = getAppSupportDir();
    const logsDir = path.join(appDir, "logs");
    if (fs.existsSync(logsDir)) dirs.push(logsDir);

    const home = os.homedir();
    const geminiLogs = path.join(home, ".gemini", "antigravity");
    if (fs.existsSync(geminiLogs)) dirs.push(geminiLogs);

    return dirs;
  }

  collectLogFiles(dir, files = []) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.collectLogFiles(fullPath, files);
        } else if (entry.isFile() && (entry.name.endsWith(".log") || entry.name.endsWith(".txt") || entry.name.endsWith(".jsonl"))) {
          files.push(fullPath);
        }
      }
    } catch (e) {}
    return files;
  }

  async scan() {
    const logDirs = this.getLogDirectories();
    const logFiles = logDirs.flatMap(d => this.collectLogFiles(d));

    for (const file of logFiles) {
      try {
        const stat = fs.statSync(file);
        const prevOffset = this.fileOffsets.get(file) || 0;
        if (stat.size <= prevOffset) {
          if (stat.size < prevOffset) this.fileOffsets.set(file, stat.size);
          continue;
        }

        const readLength = stat.size - prevOffset;
        const buffer = Buffer.alloc(readLength);
        const fd = fs.openSync(file, "r");
        fs.readSync(fd, buffer, 0, readLength, prevOffset);
        fs.closeSync(fd);
        this.fileOffsets.set(file, stat.size);

        const text = buffer.toString("utf8");
        for (const pattern of RATE_LIMIT_PATTERNS) {
          if (pattern.test(text)) {
            const config = vscode.workspace.getConfiguration("antigravityAccountSwitcher");
            const cooldown = config.get("rateLimitMonitor.cooldownSeconds", 60) * 1000;
            const now = Date.now();
            if (now - this.lastAlertAt > cooldown) {
              this.lastAlertAt = now;
              this.onDetect(pattern.toString(), path.basename(file));
            }
            return;
          }
        }
      } catch (e) {}
    }
  }
}

class AccountSwitcherUI {
  constructor(context) {
    this.context = context;
    this.slotButtons = [];
    this.saveButton = null;
    this.initStatusBar();
  }

  initStatusBar() {
    this.saveButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 105);
    this.saveButton.text = "$(add) Save Account";
    this.saveButton.tooltip = "Save current Antigravity session into a profile slot";
    this.saveButton.command = "antigravityAccountSwitcher.saveCurrentProfile";
    this.context.subscriptions.push(this.saveButton);

    for (let i = 0; i < MAX_PROFILES; i++) {
      const btn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100 - i);
      btn.command = {
        command: "antigravityAccountSwitcher.switchProfileSlot",
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
    const config = vscode.workspace.getConfiguration("antigravityAccountSwitcher");
    const maxProfiles = config.get("maxProfiles", 5);

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
        const icon = isActive ? "$(check)" : "$(account)";
        btn.text = `${icon} ${i + 1}: ${shortenLabel(slotData.name)}`;
        btn.color = isActive ? "#FFFFFF" : color;
        btn.backgroundColor = isActive ? new vscode.ThemeColor("statusBarItem.warningBackground") : undefined;
        btn.tooltip = `Slot ${i + 1}: ${slotData.name}${isActive ? " (Active)" : " - Click to Switch"}\nSaved: ${slotData.updatedAt || slotData.createdAt || "N/A"}`;
      } else {
        btn.text = `$(circle-outline) ${i + 1}: Empty`;
        btn.color = "#777777";
        btn.backgroundColor = undefined;
        btn.tooltip = `Slot ${i + 1} is empty. Click to save current profile here.`;
      }
      btn.show();
    }
  }
}

function activate(context) {
  const ui = new AccountSwitcherUI(context);

  const monitor = new RateLimitMonitor(context, (pattern, logFile) => {
    vscode.window
      .showWarningMessage(
        `⚡ Rate limit detected in ${logFile}! Switch to another Google account?`,
        "Switch Account",
        "Dismiss"
      )
      .then(selection => {
        if (selection === "Switch Account") {
          vscode.commands.executeCommand("antigravityAccountSwitcher.switchProfile");
        }
      });
  });
  monitor.start();

  // Save Profile Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityAccountSwitcher.saveCurrentProfile", async () => {
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
        vscode.window.showInformationMessage(`✓ Saved current session to Slot ${selectedSlot.slot} (${profileName})`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to save profile: ${err.message}`);
      }
    })
  );

  // Switch Profile Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityAccountSwitcher.switchProfile", async () => {
      const metadata = loadMetadata();
      const available = metadata.slots.filter(s => s.name && s.folder);
      if (available.length === 0) {
        const saveNow = "Save Current Session";
        const res = await vscode.window.showInformationMessage("No saved profiles found. Save your current session first.", saveNow);
        if (res === saveNow) {
          vscode.commands.executeCommand("antigravityAccountSwitcher.saveCurrentProfile");
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

  // Switch Profile Slot Direct Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityAccountSwitcher.switchProfileSlot", async slotNumber => {
      const metadata = loadMetadata();
      const target = metadata.slots[slotNumber - 1];

      if (!target || !target.name) {
        const answer = await vscode.window.showInformationMessage(
          `Slot ${slotNumber} is empty. Save current account session here?`,
          "Save Here",
          "Cancel"
        );
        if (answer === "Save Here") {
          const profileName = await vscode.window.showInputBox({
            prompt: `Enter name for Slot ${slotNumber}`,
            value: `Account ${slotNumber}`
          });
          if (profileName) {
            saveProfile(slotNumber, sanitizeName(profileName));
            ui.refresh();
            vscode.window.showInformationMessage(`✓ Saved to Slot ${slotNumber} (${profileName})`);
          }
        }
        return;
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

  // Delete Profile Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityAccountSwitcher.deleteProfile", async () => {
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

  // List Profiles Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityAccountSwitcher.listProfiles", () => {
      const metadata = loadMetadata();
      const list = metadata.slots
        .map(s => `Slot ${s.slot}: ${s.name ? `${s.name}${s.active ? " (Active)" : ""}` : "(Empty)"}`)
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
