const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");
const cp = require("child_process");

const PROFILE_COLORS = ["#4A90E2", "#28A745", "#F39C12", "#8E44AD", "#E84393"];
const MAX_PROFILES = 5;

// Active Baseline Models Catalog for Google Antigravity (Current Lineup)
const DEFAULT_MODELS = [
  // Gemini Models Pool
  {
    name: "Gemini 3.8 Flash (High)",
    shortName: "Gemini 3.8 Flash (High)",
    badge: "Fast",
    pool: "gemini",
    status: "available",
    isCurrentLineup: true
  },
  {
    name: "Gemini 3.8 Flash (Medium)",
    shortName: "Gemini 3.8 Flash (Medium)",
    badge: "Fast",
    pool: "gemini",
    status: "available",
    isCurrentLineup: true
  },
  {
    name: "Gemini 3.8 Flash (Low)",
    shortName: "Gemini 3.8 Flash (Low)",
    badge: "Fast",
    pool: "gemini",
    status: "available",
    isCurrentLineup: true
  },
  {
    name: "Gemini 4 Argon",
    shortName: "Gemini 4 Argon",
    badge: "Unavailable",
    pool: "gemini",
    status: "unavailable",
    unavailableReason: "Not yet available in Google Antigravity (Upcoming Preview)",
    isCurrentLineup: true
  },

  // Claude & GPT Models Pool
  {
    name: "Claude Sonnet 4.6 (Thinking)",
    shortName: "Claude Sonnet 4.6",
    badge: "Deep Reasoning",
    pool: "claude_gpt",
    status: "available",
    notice: "Partner Model",
    isCurrentLineup: true
  },
  {
    name: "Claude Opus 4.6 (Thinking)",
    shortName: "Claude Opus 4.6",
    badge: "Deep Reasoning",
    pool: "claude_gpt",
    status: "available",
    notice: "Partner Model",
    isCurrentLineup: true
  },
  {
    name: "GPT-OSS 120B (Medium)",
    shortName: "GPT-OSS 120B",
    badge: "Open Weights",
    pool: "claude_gpt",
    status: "available",
    notice: "Open Weights",
    isCurrentLineup: true
  }
];

const RATE_LIMIT_PATTERNS = [
  /rate\s*limit/i,
  /too\s*many\s*requests/i,
  /\b429\b/,
  /quota\s*exceeded/i,
  /resource\s*exhausted/i,
  /RESOURCE_EXHAUSTED/i,
  /anthropic.*rate/i,
  /claude.*rate/i,
  /gemini.*rate/i,
  /usage\s*limit/i,
  /exceeded\s*your\s*current\s*quota/i
];

function createFreshPool() {
  return {
    gemini: {
      name: "Gemini Models",
      weeklyRemaining: 100,
      fiveHourRemaining: 100,
      fiveHourUsedTurns: 0,
      weeklyUsedTurns: 0,
      lastActiveTimestamp: 0
    },
    claude_gpt: {
      name: "Claude and GPT models",
      weeklyRemaining: 100,
      fiveHourRemaining: 100,
      fiveHourUsedTurns: 0,
      weeklyUsedTurns: 0,
      lastActiveTimestamp: 0
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

// Model Classification Helper
function classifyModel(modelName) {
  if (!modelName || typeof modelName !== "string") {
    return { name: "Gemini 3.8 Flash (High)", shortName: "Gemini 3.8 Flash", badge: "Fast", pool: "gemini", status: "available", isCurrentLineup: true };
  }
  const cleanName = modelName.trim();
  const lower = cleanName.toLowerCase();

  // 1. Google Antigravity Official Active Lineup Canonical Mapping
  if (lower.includes("argon")) {
    return {
      name: "Gemini 4 Argon",
      shortName: "Gemini 4 Argon",
      badge: "Unavailable",
      pool: "gemini",
      status: "unavailable",
      unavailableReason: "Not yet available in Google Antigravity (Upcoming Preview)",
      isCurrentLineup: true
    };
  }

  if (lower.includes("3.8") && lower.includes("flash")) {
    if (lower.includes("medium")) {
      return {
        name: "Gemini 3.8 Flash (Medium)",
        shortName: "Gemini 3.8 Flash (Medium)",
        badge: "Fast",
        pool: "gemini",
        status: "available",
        isCurrentLineup: true
      };
    }
    if (lower.includes("low")) {
      return {
        name: "Gemini 3.8 Flash (Low)",
        shortName: "Gemini 3.8 Flash (Low)",
        badge: "Fast",
        pool: "gemini",
        status: "available",
        isCurrentLineup: true
      };
    }
    return {
      name: "Gemini 3.8 Flash (High)",
      shortName: "Gemini 3.8 Flash (High)",
      badge: "Fast",
      pool: "gemini",
      status: "available",
      isCurrentLineup: true
    };
  }

  if (lower.includes("claude") && lower.includes("sonnet")) {
    return {
      name: "Claude Sonnet 4.6 (Thinking)",
      shortName: "Claude Sonnet 4.6",
      badge: "Deep Reasoning",
      pool: "claude_gpt",
      status: "available",
      notice: "Partner Model",
      isCurrentLineup: true
    };
  }

  if (lower.includes("claude") && lower.includes("opus")) {
    return {
      name: "Claude Opus 4.6 (Thinking)",
      shortName: "Claude Opus 4.6",
      badge: "Deep Reasoning",
      pool: "claude_gpt",
      status: "available",
      notice: "Partner Model",
      isCurrentLineup: true
    };
  }

  if (lower.includes("gpt-oss") || lower.includes("gpt_oss") || lower.includes("120b")) {
    return {
      name: "GPT-OSS 120B (Medium)",
      shortName: "GPT-OSS 120B",
      badge: "Open Weights",
      pool: "claude_gpt",
      status: "available",
      notice: "Open Weights",
      isCurrentLineup: true
    };
  }

  // 2. Previous / Deprecated / Custom Models (Preserved in Historical Archive)
  const isGemini = lower.includes("gemini");
  const pool = isGemini ? "gemini" : "claude_gpt";
  let shortName = cleanName.replace(/\s*\((?:High|Medium|Low|Thinking)\)\s*/gi, "").trim();
  if (!shortName) shortName = cleanName;

  let badge = "Fast";
  if (lower.includes("thinking") || lower.includes("opus") || lower.includes("sonnet")) {
    badge = "Deep Reasoning";
  } else if (lower.includes("pro")) {
    badge = "Standard";
  } else if (lower.includes("oss") || lower.includes("open")) {
    badge = "Open Weights";
  } else if (lower.includes("lite") || lower.includes("flash")) {
    badge = "Fast";
  }

  // Auto-detect future generations (Gemini 4+, 3.9, Claude 4.7+, Claude 5+, GPT 5+, GPT-OSS >=120B)
  const isFutureOrNewModel = (
    /\bgemini[\s\-_]*(?:[4-9]|\d{2,}|3\.[8-9])/i.test(cleanName) ||
    /\bclaude[\s\-_]*(?:sonnet|opus)?[\s\-_]*(?:[5-9]|\d{2,}|4\.[6-9])/i.test(cleanName) ||
    /\b(gpt[\s\-_]*[5-9]|gpt[\s\-_]*oss[\s\-_]*\d{3,}b)/i.test(cleanName)
  );

  return {
    name: cleanName,
    shortName,
    badge,
    pool,
    status: "available",
    isCurrentLineup: isFutureOrNewModel
  };
}

// Dynamic Model Discovery Engine
let cachedDynamicModels = null;
let lastModelDiscoveryTime = 0;
let cachedBinaryModels = [];
let binaryDiscoveryStarted = false;

function scheduleBinaryModelDiscovery(onNewModelsFound) {
  if (binaryDiscoveryStarted) return;
  binaryDiscoveryStarted = true;

  setTimeout(() => {
    const home = os.homedir();
    const binaryCandidates = [
      "/Applications/Antigravity.app/Contents/Resources/bin/language_server",
      "/Applications/Antigravity IDE.app/Contents/Resources/app/extensions/antigravity/bin/language_server_macos_arm",
      path.join(home, ".gemini", "antigravity", "bin", "language_server")
    ];

    const patterns = [
      /Gemini 3\.[0-9] (?:Flash|Pro)(?: \((?:High|Medium|Low)\))?/g,
      /Gemini 3\.[0-9] Flash (?:Lite|Image)/g,
      /Claude (?:Sonnet|Opus) [0-9\.]+(?: \((?:Thinking)\))?/g,
      /GPT-OSS [0-9]+B(?: \((?:Medium|High|Low)\))?/g
    ];

    for (const binPath of binaryCandidates) {
      if (!fs.existsSync(binPath)) continue;
      fs.readFile(binPath, (err, buf) => {
        if (err || !buf) return;
        const str = buf.toString("latin1");
        let added = false;
        for (const pat of patterns) {
          const matches = str.match(pat);
          if (matches) {
            for (const m of matches) {
              const trimmed = m.trim();
              if (trimmed.length > 5 && !cachedBinaryModels.some(x => x.name === trimmed)) {
                cachedBinaryModels.push(classifyModel(trimmed));
                added = true;
              }
            }
          }
        }
        if (added) {
          cachedDynamicModels = null;
          if (typeof onNewModelsFound === "function") {
            try { onNewModelsFound(); } catch (e) {}
          }
        }
      });
    }
  }, 4000);
}

function getDynamicModelCatalog(uiCallback) {
  const now = Date.now();
  if (cachedDynamicModels && now - lastModelDiscoveryTime < 30000) {
    return cachedDynamicModels;
  }

  const modelMap = new Map();

  function addModelIfNew(rawName) {
    if (!rawName) return;
    const classified = typeof rawName === "string" ? classifyModel(rawName) : rawName;
    if (!classified || !classified.name) return;
    if (modelMap.has(classified.name)) return;
    for (const existing of modelMap.values()) {
      if (existing.name.toLowerCase() === classified.name.toLowerCase()) {
        return;
      }
    }
    modelMap.set(classified.name, classified);
  }

  // 1. Seed with Default Models (Google Antigravity Official Active Lineup)
  for (const m of DEFAULT_MODELS) {
    modelMap.set(m.name, m);
  }

  // 2. Add Async-Discovered Binary Models
  for (const bm of cachedBinaryModels) {
    addModelIfNew(bm);
  }

  // Schedule background discovery if not already run
  scheduleBinaryModelDiscovery(() => {
    if (uiCallback && typeof uiCallback.refresh === "function") {
      uiCallback.refresh();
    }
  });

  // 3. Discover from state.vscdb (UserStatus protobuf)
  const home = os.homedir();
  const stateDbCandidates = [
    path.join(home, "Library", "Application Support", "Antigravity", "User", "globalStorage", "state.vscdb"),
    path.join(home, "Library", "Application Support", "Antigravity IDE", "User", "globalStorage", "state.vscdb"),
    path.join(home, ".config", "Antigravity", "User", "globalStorage", "state.vscdb")
  ];

  for (const stateDb of stateDbCandidates) {
    if (!fs.existsSync(stateDb)) continue;
    try {
      const rawB64 = cp.execSync(
        `sqlite3 "${stateDb}" "SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.userStatus';"`,
        { encoding: "utf8", timeout: 800 }
      ).trim();

      if (rawB64) {
        const b1 = Buffer.from(rawB64, "base64");
        const nestedMatch = b1.toString("utf8").match(/Gg[A-Za-z0-9+/=]{100,}/);
        if (nestedMatch) {
          const userStatusDecoded = Buffer.from(nestedMatch[0], "base64").toString("utf8");
          const found = userStatusDecoded.match(/(?:Gemini|Claude|GPT)[A-Za-z0-9\.\-\_\ \(\)]+/g);
          if (found) {
            for (const name of found) {
              const trimmed = name.trim();
              if (trimmed.length > 5 && trimmed.length < 40) {
                addModelIfNew(trimmed);
              }
            }
          }
        }
      }
    } catch (e) {}
  }

  // 4. Discover from Tracked Models & User Custom Models
  try {
    const config = vscode.workspace.getConfiguration("antigravityProfilePilot");
    const customModels = config.get("customModels", []);
    for (const cm of customModels) {
      if (typeof cm === "string" && cm.trim()) {
        addModelIfNew(cm.trim());
      }
    }
  } catch (e) {}

  const meta = loadMetadata();
  if (Array.isArray(meta.trackedModels)) {
    for (const tm of meta.trackedModels) {
      if (typeof tm === "string" && tm.trim()) {
        addModelIfNew(tm.trim());
      }
    }
  }

  cachedDynamicModels = Array.from(modelMap.values());
  lastModelDiscoveryTime = now;
  return cachedDynamicModels;
}

// Auto-Detect Current Active Model in Antigravity
function detectActiveModel(fallback = "Gemini 3.8 Flash (High)") {
  const home = os.homedir();

  // 1. Check antigravity_state.pbtxt
  const pbtxt = path.join(home, ".gemini", "antigravity", "antigravity_state.pbtxt");
  if (fs.existsSync(pbtxt)) {
    try {
      const content = fs.readFileSync(pbtxt, "utf8");
      const m = content.match(/last_selected_agent_model:\s*([A-Za-z0-9_]+)/);
      if (m) {
        const val = m[1];
        if (val === "MODEL_PLACEHOLDER_M318") return "Gemini 3.8 Flash (High)";
        if (val.startsWith("Gemini") || val.startsWith("Claude") || val.startsWith("GPT")) {
          return val;
        }
      }
    } catch (e) {}
  }

  // 2. Check latest conversation generation metadata
  const convosDir = path.join(home, ".gemini", "antigravity", "conversations");
  if (fs.existsSync(convosDir)) {
    try {
      const files = fs.readdirSync(convosDir)
        .filter(f => f.endsWith(".db"))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(convosDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > 0) {
        const latestDb = path.join(convosDir, files[0].name);
        const hex = cp.execSync(
          `sqlite3 "${latestDb}" "SELECT substr(hex(data), -4000) FROM gen_metadata ORDER BY idx DESC LIMIT 1;"`,
          { encoding: "utf8", timeout: 1000 }
        ).trim();

        if (hex) {
          const str = Buffer.from(hex, "hex").toString("utf8");
          if (str.includes("gemini-3.8-flash")) return "Gemini 3.8 Flash (High)";
          if (str.includes("gemini-3.7-flash")) return "Gemini 3.7 Flash (High)";
          if (str.includes("gemini-3.6-flash")) return "Gemini 3.6 Flash (High)";
          if (str.includes("gemini-3.5-flash")) return "Gemini 3.5 Flash (High)";
          if (str.includes("claude-sonnet-4.6")) return "Claude Sonnet 4.6 (Thinking)";
          if (str.includes("claude-opus-4.6")) return "Claude Opus 4.6 (Thinking)";
          if (str.includes("claude-sonnet-5")) return "Claude Sonnet 5.5";
          if (str.includes("claude-opus-5")) return "Claude Opus 5.5";
          if (str.includes("gpt-oss")) return "GPT-OSS 120B (Medium)";
        }
      }
    } catch (e) {}
  }

  return fallback;
}

// Auto-Detect Current Logged-in Google Account Email
function detectLoggedInEmail() {
  const home = os.homedir();
  
  // 1. Check app_storage.json
  const appStorageDirs = getAllAppSupportDirs();
  for (const dir of appStorageDirs) {
    const f = path.join(dir, "app_storage.json");
    if (fs.existsSync(f)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(f, "utf8"));
        if (parsed["jetski.onboarding.lastLoginUsername"]) {
          return parsed["jetski.onboarding.lastLoginUsername"];
        }
      } catch (e) {}
    }
  }

  // 2. Check state.vscdb
  for (const dir of appStorageDirs) {
    const dbPath = path.join(dir, "User", "globalStorage", "state.vscdb");
    if (fs.existsSync(dbPath)) {
      try {
        const rawB64 = cp.execSync(
          `sqlite3 "${dbPath}" "SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.userStatus';"`,
          { encoding: "utf8", timeout: 1000 }
        ).trim();
        if (rawB64) {
          const b1 = Buffer.from(rawB64, "base64");
          const nestedMatch = b1.toString("utf8").match(/Gg[A-Za-z0-9+/=]{100,}/);
          if (nestedMatch) {
            const decoded = Buffer.from(nestedMatch[0], "base64").toString("utf8");
            const emailMatch = decoded.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch) return emailMatch[0];
          }
        }
      } catch (e) {}
    }
  }

  return null;
}

// Plan Tier Discovery & Model Availability Engine
const slotTierCache = new Map();
let lastTierCacheClear = 0;

const TIER_REGISTRY = {
  "auto": { id: "auto", name: "Auto-Detect", badge: "Auto", isProOrHigher: false, isPaid: false },
  "paid_third_party": { id: "paid_third_party", name: "Third-Party Paid Tier (Partner / Reseller)", badge: "3rd-Party Paid", isProOrHigher: true, isPaid: true },
  "g1-pro-tier": { id: "g1-pro-tier", name: "Google AI Pro", badge: "Pro", isProOrHigher: true, isPaid: true },
  "g1-ultra-tier": { id: "g1-ultra-tier", name: "Google AI Ultra", badge: "Ultra", isProOrHigher: true, isPaid: true },
  "enterprise": { id: "enterprise", name: "Enterprise / Workspace (Teams)", badge: "Enterprise", isProOrHigher: true, isPaid: true },
  "byok": { id: "byok", name: "BYOK / Custom Provider Paid Tier", badge: "BYOK Paid", isProOrHigher: true, isPaid: true },
  "free": { id: "free", name: "Free Tier", badge: "Free", isProOrHigher: false, isPaid: false }
};

function clearTierCache() {
  slotTierCache.clear();
  lastTierCacheClear = Date.now();
}

function getSlotTierInfo(slotData, isActive = false) {
  if (!slotData) {
    return { tierId: "unknown", tierName: "Unknown", tierBadge: "N/A", isProOrHigher: false, models: [] };
  }

  const slotKey = `slot_${slotData.slot}_active_${isActive}`;
  const now = Date.now();
  if (now - lastTierCacheClear > 30000) {
    slotTierCache.clear();
    lastTierCacheClear = now;
  }
  if (slotTierCache.has(slotKey)) {
    return slotTierCache.get(slotKey);
  }

  // 1. Check for manual/explicit tier override on slot or in configuration
  let overrideTier = slotData.customTier;
  try {
    const config = vscode.workspace.getConfiguration("antigravityProfilePilot");
    const slotTiers = config.get("slotTiers", {});
    if (slotTiers && slotTiers[String(slotData.slot)]) {
      overrideTier = slotTiers[String(slotData.slot)];
    }
  } catch (e) {}

  if (overrideTier && overrideTier !== "auto" && TIER_REGISTRY[overrideTier]) {
    const reg = TIER_REGISTRY[overrideTier];
    const result = {
      tierId: reg.id,
      tierName: reg.name,
      tierBadge: reg.badge,
      isProOrHigher: reg.isProOrHigher,
      isOverridden: true,
      models: []
    };
    slotTierCache.set(slotKey, result);
    return result;
  }

  // 2. Check slot name hints (e.g. "Work (Paid)", "OpenRouter", "Enterprise", "BYOK", "Reseller")
  const sName = (slotData.name || "").toLowerCase();
  if (sName.includes("(paid)") || sName.includes("third-party") || sName.includes("thirdparty") || sName.includes("reseller") || sName.includes("partner") || sName.includes("openrouter")) {
    const result = {
      tierId: "paid_third_party",
      tierName: "Third-Party Paid Tier",
      tierBadge: "3rd-Party Paid",
      isProOrHigher: true,
      models: []
    };
    slotTierCache.set(slotKey, result);
    return result;
  }
  if (sName.includes("enterprise") || sName.includes("workspace") || sName.includes("corp") || sName.includes("business")) {
    const result = {
      tierId: "enterprise",
      tierName: "Enterprise / Workspace",
      tierBadge: "Enterprise",
      isProOrHigher: true,
      models: []
    };
    slotTierCache.set(slotKey, result);
    return result;
  }
  if (sName.includes("byok")) {
    const result = {
      tierId: "byok",
      tierName: "BYOK / Custom API Tier",
      tierBadge: "BYOK Paid",
      isProOrHigher: true,
      models: []
    };
    slotTierCache.set(slotKey, result);
    return result;
  }

  // 3. Auto-detect from state.vscdb
  let dbPath = null;
  if (isActive) {
    const appSupportDirs = getAllAppSupportDirs();
    for (const dir of appSupportDirs) {
      const candidate = path.join(dir, "User", "globalStorage", "state.vscdb");
      if (fs.existsSync(candidate)) {
        dbPath = candidate;
        break;
      }
    }
  } else if (slotData.folder) {
    const profilesRoot = getProfilesRoot();
    const candidate = path.join(profilesRoot, slotData.folder, "User", "globalStorage", "state.vscdb");
    if (fs.existsSync(candidate)) {
      dbPath = candidate;
    }
  }

  const defaultResult = {
    tierId: "free",
    tierName: "Free Tier",
    tierBadge: "Free",
    isProOrHigher: false,
    models: []
  };

  if (!dbPath || !fs.existsSync(dbPath)) {
    slotTierCache.set(slotKey, defaultResult);
    return defaultResult;
  }

  try {
    const rawB64 = cp.execSync(
      `sqlite3 "${dbPath}" "SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.userStatus';"`,
      { encoding: "utf8", timeout: 1200 }
    ).trim();

    if (!rawB64) {
      slotTierCache.set(slotKey, defaultResult);
      return defaultResult;
    }

    const b1 = Buffer.from(rawB64, "base64");
    const nestedMatch = b1.toString("utf8").match(/Gg[A-Za-z0-9+/=]{100,}/);
    if (!nestedMatch) {
      slotTierCache.set(slotKey, defaultResult);
      return defaultResult;
    }

    const rawProto = Buffer.from(nestedMatch[0], "base64");
    const str = rawProto.toString("latin1");

    let tierId = "free";
    let tierName = "Free Tier";
    let tierBadge = "Free";
    let isProOrHigher = false;

    if (str.includes("g1-ultra-tier")) {
      tierId = "g1-ultra-tier";
      tierName = "Google AI Ultra";
      tierBadge = "Ultra";
      isProOrHigher = true;
    } else if (str.includes("g1-pro-tier") || str.includes("G1_PLUS_TIER")) {
      tierId = "g1-pro-tier";
      tierName = "Google AI Pro";
      tierBadge = "Pro";
      isProOrHigher = true;
    } else if (str.includes("GOOGLER_TIER")) {
      tierId = "googler";
      tierName = "Google Internal / Partner";
      tierBadge = "Partner";
      isProOrHigher = true;
    } else if (str.includes("TEAMS_TIER") || str.includes("coding_plan_id") || str.includes("cortex_plan_id") || /enterprise|workspace/i.test(str)) {
      tierId = "enterprise";
      tierName = "Enterprise / Workspace";
      tierBadge = "Enterprise";
      isProOrHigher = true;
    } else if (/third_party|partner|reseller/i.test(str)) {
      tierId = "paid_third_party";
      tierName = "Third-Party Paid Tier";
      tierBadge = "3rd-Party Paid";
      isProOrHigher = true;
    }

    const rawModels = str.match(/(?:Gemini|Claude|GPT)[A-Za-z0-9\.\-\_\ \(\)]+/g) || [];
    const modelsFound = Array.from(new Set(rawModels));

    // Dynamic heuristic: If account has access to Pro-grade models (Gemini 3.8/3.7/3.6 Flash, Claude 5.5, or 10+ models),
    // then it is a verified Paid / Third-Party partner tier even if not billed through personal Google One!
    if (!isProOrHigher) {
      const hasProTierModels = modelsFound.some(m => /3\.[678]|5\.5/i.test(m));
      if (hasProTierModels || modelsFound.length >= 10) {
        const emailMatch = str.match(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        const domain = emailMatch ? emailMatch[1].toLowerCase() : "";
        const isOrgDomain = domain && domain !== "gmail.com" && domain !== "googlemail.com";

        if (isOrgDomain) {
          tierId = "enterprise";
          tierName = "Enterprise / Workspace";
          tierBadge = "Enterprise";
          isProOrHigher = true;
        } else {
          tierId = "paid_third_party";
          tierName = "Third-Party Paid Tier";
          tierBadge = "3rd-Party Paid";
          isProOrHigher = true;
        }
      }
    }

    const result = {
      tierId,
      tierName,
      tierBadge,
      isProOrHigher,
      models: modelsFound
    };

    slotTierCache.set(slotKey, result);
    return result;
  } catch (e) {
    slotTierCache.set(slotKey, defaultResult);
    return defaultResult;
  }
}

function isModelAvailableForSlot(modelObj, tierInfo) {
  if (modelObj && modelObj.status === "unavailable") {
    return {
      available: false,
      isUnavailable: true,
      badge: "Unavailable",
      reason: modelObj.unavailableReason || `"${modelObj.name}" is not yet available in Google Antigravity (Upcoming Preview).`
    };
  }
  if (!tierInfo) return { available: true, badge: "", reason: "" };
  if (tierInfo.isProOrHigher) {
    return { available: true, badge: "", reason: "" };
  }

  const mName = (modelObj.name || "").toLowerCase();
  const mShort = (modelObj.shortName || "").toLowerCase();

  // If tierInfo contains explicit allowed models from state.vscdb:
  if (Array.isArray(tierInfo.models) && tierInfo.models.length > 0) {
    const isExplicitlyEnabled = tierInfo.models.some(m => {
      const lower = m.toLowerCase();
      return lower === mName || lower.includes(mShort) || mName.includes(lower);
    });
    if (isExplicitlyEnabled) {
      return { available: true, badge: "", reason: "" };
    }
  }

  // Known Pro/Ultra exclusive indicators
  const isProExclusive = (
    mName.includes("3.8") ||
    mName.includes("3.7") ||
    mName.includes("3.6") ||
    mName.includes("5.5") ||
    mName.includes("ultra") ||
    (mName.includes("(high)") && !mName.includes("3.5") && !mName.includes("3.1"))
  );

  if (isProExclusive) {
    return {
      available: false,
      requiredTier: "Google AI Pro or Third-Party Paid Tier",
      badge: "Requires Pro/Paid Tier",
      reason: `"${modelObj.name}" is locked on ${tierInfo.tierName}. A Google AI Pro, Ultra, or Third-Party Paid Tier is required.`
    };
  }

  return { available: true, badge: "", reason: "" };
}

function normalizeMetadata(raw, maxProfiles) {
  const base = createEmptySlots(maxProfiles);
  const detectedActive = detectActiveModel();

  if (!raw || !Array.isArray(raw.slots)) {
    return {
      slots: base,
      activeSlot: 1,
      currentModel: detectedActive,
      trackedModels: DEFAULT_MODELS.map(m => m.name)
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
      customTier: incoming.customTier || "auto",
      pools: incoming.pools || createFreshPool(),
      limits: incoming.limits || {},
      usage: incoming.usage || {}
    };
  }

  const modelNames = DEFAULT_MODELS.map(m => m.name);
  let tracked = modelNames;
  if (Array.isArray(raw.trackedModels) && raw.trackedModels.length > 0) {
    tracked = Array.from(new Set([...modelNames, ...raw.trackedModels]));
  }

  return {
    slots: base,
    activeSlot: raw.activeSlot || 1,
    currentModel: raw.currentModel || detectedActive,
    trackedModels: tracked
  };
}

function getActiveModel() {
  const detected = detectActiveModel(null);
  if (detected) return detected;
  const metadata = loadMetadata();
  return metadata.currentModel || "Gemini 3.8 Flash (High)";
}

function setActiveModel(modelName) {
  const metadata = loadMetadata();
  metadata.currentModel = modelName;
  if (!Array.isArray(metadata.trackedModels)) metadata.trackedModels = [];
  if (!metadata.trackedModels.includes(modelName)) {
    metadata.trackedModels.push(modelName);
  }
  saveMetadata(metadata);
  cachedDynamicModels = null;
}

function addTrackedModel(modelName) {
  const metadata = loadMetadata();
  if (!Array.isArray(metadata.trackedModels)) metadata.trackedModels = [];
  if (!metadata.trackedModels.includes(modelName)) {
    metadata.trackedModels.push(modelName);
    saveMetadata(metadata);
    cachedDynamicModels = null;
  }
}

function loadMetadata(maxProfiles = MAX_PROFILES) {
  ensureProfilesRoot();
  const metadataPath = getMetadataPath();
  const detectedActive = detectActiveModel();

  if (!fs.existsSync(metadataPath)) {
    const initial = {
      slots: createEmptySlots(maxProfiles),
      activeSlot: 1,
      currentModel: detectedActive,
      trackedModels: DEFAULT_MODELS.map(m => m.name)
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
      activeSlot: 1,
      currentModel: detectedActive,
      trackedModels: DEFAULT_MODELS.map(m => m.name)
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

  const geminiUsed = 100 - (typeof gemini.weeklyRemaining === "number" ? gemini.weeklyRemaining : 100);
  const claudeUsed = 100 - (typeof claudeGpt.weeklyRemaining === "number" ? claudeGpt.weeklyRemaining : 100);
  const avgWeeklyRemaining = Math.round(((gemini.weeklyRemaining ?? 100) + (claudeGpt.weeklyRemaining ?? 100)) / 2);
  const avgWeeklyUsed = 100 - avgWeeklyRemaining;

  const isRateLimited = !!(
    (slotData && slotData.limits && (slotData.limits.gemini?.rateLimited || slotData.limits.claude_gpt?.rateLimited)) ||
    gemini.fiveHourRemaining === 0 ||
    claudeGpt.fiveHourRemaining === 0
  );

  return {
    gemini,
    claudeGpt,
    geminiUsed,
    claudeUsed,
    overallUsedPercent: avgWeeklyUsed,
    overallPendingPercent: avgWeeklyRemaining,
    isRateLimited
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
  
  const isExistingSlot = metadata.slots[slot - 1] && metadata.slots[slot - 1].pools;
  const initialPools = isExistingSlot ? metadata.slots[slot - 1].pools : createFreshPool();

  metadata.slots[slot - 1] = {
    slot: slot,
    name: profileName,
    folder: folderName,
    createdAt: metadata.slots[slot - 1].createdAt || now,
    updatedAt: now,
    active: true,
    pools: initialPools,
    limits: metadata.slots[slot - 1].limits || {},
    usage: metadata.slots[slot - 1].usage || {}
  };

  metadata.slots.forEach((s, idx) => {
    if (idx !== slot - 1) s.active = false;
  });
  metadata.activeSlot = slot;

  saveMetadata(metadata);
  clearTierCache();
  cachedDynamicModels = null;
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
  clearTierCache();
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
  clearTierCache();
  cachedDynamicModels = null;

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
  clearTierCache();
  cachedDynamicModels = null;
  return { success: true };
}

// Automatic Usage Tracker & Background Rate Limit Monitor
class AutoUsageTracker {
  constructor(context, ui) {
    this.context = context;
    this.ui = ui;
    this.timer = null;
    this.lastAlertTime = 0;
    this.fileOffsets = new Map();
  }

  start() {
    this.stop();
    const config = vscode.workspace.getConfiguration("antigravityProfilePilot");
    if (!config.get("rateLimitMonitor.enabled", true)) return;

    const seconds = config.get("rateLimitMonitor.scanIntervalSeconds", 15);
    this.timer = setInterval(() => {
      this.tick().catch(() => {});
    }, Math.max(5, seconds) * 1000);

    // Initial immediate tick
    setTimeout(() => this.tick().catch(() => {}), 1500);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    let metadata = loadMetadata();
    const activeSlotNum = metadata.activeSlot || 1;
    const activeSlot = metadata.slots[activeSlotNum - 1];
    if (!activeSlot) return;

    let changed = false;

    // 1. Auto-fill account name if currently placeholder or empty
    const detectedEmail = detectLoggedInEmail();
    if (detectedEmail && (!activeSlot.name || activeSlot.name.startsWith("Account ") || activeSlot.name.startsWith("Slot "))) {
      activeSlot.name = detectedEmail;
      changed = true;
    }

    // 2. Scan Antigravity Conversation Activity for 5h and Weekly counts
    const home = os.homedir();
    const convosDir = path.join(home, ".gemini", "antigravity", "conversations");
    const now = Date.now();
    const fiveHoursAgo = now - 5 * 3600 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

    let gemini5hTurns = 0;
    let geminiWeeklyTurns = 0;
    let claude5hTurns = 0;
    let claudeWeeklyTurns = 0;
    const perModelUsage = {};

    if (fs.existsSync(convosDir)) {
      try {
        const files = fs.readdirSync(convosDir).filter(f => f.endsWith(".db"));
        for (const f of files) {
          const fp = path.join(convosDir, f);
          const stat = fs.statSync(fp);
          if (stat.mtimeMs < sevenDaysAgo) continue;

          // Query generation count
          let count = 0;
          try {
            const out = cp.execSync(`sqlite3 "${fp}" "SELECT count(*) FROM gen_metadata;"`, { encoding: "utf8", timeout: 800 }).trim();
            count = parseInt(out, 10) || 0;
          } catch (e) {}

          if (count === 0) continue;

          // Determine model used
          let modelStr = "gemini";
          try {
            const hex = cp.execSync(`sqlite3 "${fp}" "SELECT substr(hex(data), -4000) FROM gen_metadata ORDER BY idx DESC LIMIT 1;"`, { encoding: "utf8", timeout: 800 }).trim();
            if (hex) {
              const decoded = Buffer.from(hex, "hex").toString("utf8");
              const usedClaude = /used_claude\s+true/i.test(decoded);
              const usedNonGemini = /used_non_gemini_model\s+true/i.test(decoded);
              const mMatch = decoded.match(/(gemini-[a-z0-9\.\-]+|claude-[a-z0-9\.\-]+|gpt-[a-z0-9\.\-]+)/i);

              let friendly = "Gemini 3.8 Flash (High)";
              if (mMatch) {
                const rawModel = mMatch[0].toLowerCase();
                if (rawModel.includes("gemini-3.8-flash")) {
                  if (rawModel.includes("medium")) {
                    friendly = "Gemini 3.8 Flash (Medium)";
                  } else if (rawModel.includes("low")) {
                    friendly = "Gemini 3.8 Flash (Low)";
                  } else {
                    friendly = "Gemini 3.8 Flash (High)";
                  }
                }
                else if (rawModel.includes("gemini-4-argon") || rawModel.includes("argon")) friendly = "Gemini 4 Argon";
                else if (rawModel.includes("gemini-3.7-flash")) friendly = "Gemini 3.7 Flash (High)";
                else if (rawModel.includes("gemini-3.6-flash")) friendly = "Gemini 3.6 Flash (High)";
                else if (rawModel.includes("gemini-3.5-flash")) friendly = "Gemini 3.5 Flash (High)";
                else if (rawModel.includes("gemini-3.1-pro")) friendly = "Gemini 3.1 Pro (High)";
                else if (rawModel.includes("claude-sonnet")) friendly = "Claude Sonnet 4.6 (Thinking)";
                else if (rawModel.includes("claude-opus")) friendly = "Claude Opus 4.6 (Thinking)";
                else if (rawModel.includes("gpt-oss")) friendly = "GPT-OSS 120B (Medium)";
              }

              if (usedClaude || usedNonGemini || friendly.toLowerCase().includes("claude") || friendly.toLowerCase().includes("gpt")) {
                modelStr = "claude_gpt";
              } else {
                modelStr = "gemini";
              }

              perModelUsage[friendly] = (perModelUsage[friendly] || 0) + count;
            }
          } catch (e) {}

          if (modelStr === "gemini") {
            if (stat.mtimeMs >= fiveHoursAgo) gemini5hTurns += count;
            geminiWeeklyTurns += count;
          } else {
            if (stat.mtimeMs >= fiveHoursAgo) claude5hTurns += count;
            claudeWeeklyTurns += count;
          }
        }
      } catch (e) {}
    }

    // 3. Scan logs for Rate Limit (429 / RESOURCE_EXHAUSTED) occurrences
    let detectedRateLimitPool = null;
    let rateLimitReason = "";

    const logDirs = [
      path.join(getAppSupportDir(), "logs"),
      path.join(home, ".gemini", "antigravity", "logs"),
      path.join(home, ".gemini", "antigravity-cli", "log")
    ];

    for (const d of logDirs) {
      if (!fs.existsSync(d)) continue;
      try {
        const files = fs.readdirSync(d);
        for (const file of files) {
          if (!file.endsWith(".log") && !file.endsWith(".txt")) continue;
          const fp = path.join(d, file);
          const stat = fs.statSync(fp);
          const prev = this.fileOffsets.get(fp) || 0;
          if (stat.size <= prev) {
            if (stat.size < prev) this.fileOffsets.set(fp, stat.size);
            continue;
          }

          const readLen = stat.size - prev;
          const buffer = Buffer.alloc(readLen);
          const fd = fs.openSync(fp, "r");
          fs.readSync(fd, buffer, 0, readLen, prev);
          fs.closeSync(fd);
          this.fileOffsets.set(fp, stat.size);

          const text = buffer.toString("utf8");
          for (const pattern of RATE_LIMIT_PATTERNS) {
            if (pattern.test(text)) {
              detectedRateLimitPool = /claude|anthropic/i.test(text) ? "claude_gpt" : "gemini";
              rateLimitReason = pattern.toString();
              break;
            }
          }
          if (detectedRateLimitPool) break;
        }
      } catch (e) {}
      if (detectedRateLimitPool) break;
    }

    // 4. Update Pools and Usage in active slot
    if (!activeSlot.pools) activeSlot.pools = createFreshPool();
    if (!activeSlot.limits) activeSlot.limits = {};
    if (!activeSlot.usage) activeSlot.usage = {};

    // Merge model turn counts
    for (const [mName, count] of Object.entries(perModelUsage)) {
      activeSlot.usage[mName] = {
        used: count,
        lastUsed: new Date().toISOString()
      };
      changed = true;
    }

    // Scale pool capacities based on account plan tier (Pro/Ultra vs Free)
    const activeTierInfo = getSlotTierInfo(activeSlot, true);
    const gemini5hCapacity = activeTierInfo.isProOrHigher ? 800 : 250;
    const geminiWeeklyCapacity = activeTierInfo.isProOrHigher ? 2500 : 800;
    const claude5hCapacity = activeTierInfo.isProOrHigher ? 400 : 150;
    const claudeWeeklyCapacity = activeTierInfo.isProOrHigher ? 1500 : 500;

    // Gemini Pool Calculations
    const gemini5hUsedPercent = Math.min(95, Math.round((gemini5hTurns / gemini5hCapacity) * 100));
    const geminiWeeklyUsedPercent = Math.min(95, Math.round((geminiWeeklyTurns / geminiWeeklyCapacity) * 100));

    // Claude / GPT Pool Calculations
    const claude5hUsedPercent = Math.min(95, Math.round((claude5hTurns / claude5hCapacity) * 100));
    const claudeWeeklyUsedPercent = Math.min(95, Math.round((claudeWeeklyTurns / claudeWeeklyCapacity) * 100));

    if (detectedRateLimitPool) {
      activeSlot.limits[detectedRateLimitPool] = {
        rateLimited: true,
        detectedAt: now,
        reason: rateLimitReason
      };
      if (detectedRateLimitPool === "gemini") {
        activeSlot.pools.gemini.fiveHourRemaining = 0;
      } else {
        activeSlot.pools.claude_gpt.fiveHourRemaining = 0;
      }
      changed = true;

      // Trigger Alert with Cooldown
      const config = vscode.workspace.getConfiguration("antigravityProfilePilot");
      const cooldownMs = config.get("rateLimitMonitor.cooldownSeconds", 60) * 1000;
      if (now - this.lastAlertTime > cooldownMs) {
        this.lastAlertTime = now;
        const poolName = detectedRateLimitPool === "gemini" ? "Gemini Models" : "Claude & GPT Models";
        const alternateSlot = metadata.slots.find(s => s.slot !== activeSlotNum && s.name);

        const prompt = alternateSlot
          ? `⚡ Rate limit reached on ${poolName} for Slot ${activeSlotNum} (${activeSlot.name}). Switch to Slot ${alternateSlot.slot} (${alternateSlot.name})?`
          : `⚡ Rate limit reached on ${poolName} for Slot ${activeSlotNum} (${activeSlot.name}).`;

        const options = alternateSlot
          ? [`Switch to Slot ${alternateSlot.slot}`, "View Quota Drill-Down", "Dismiss"]
          : ["View Quota Drill-Down", "Dismiss"];

        vscode.window.showWarningMessage(prompt, ...options).then(choice => {
          if (alternateSlot && choice === `Switch to Slot ${alternateSlot.slot}`) {
            vscode.commands.executeCommand("antigravityProfilePilot.switchProfileSlot", alternateSlot.slot);
          } else if (choice === "View Quota Drill-Down") {
            vscode.commands.executeCommand("antigravityProfilePilot.showUsageBreakdown");
          }
        });
      }
    } else {
      // Normal activity auto-update
      const newGemini5h = Math.max(5, 100 - gemini5hUsedPercent);
      const newGeminiWk = Math.max(5, 100 - geminiWeeklyUsedPercent);
      const newClaude5h = Math.max(5, 100 - claude5hUsedPercent);
      const newClaudeWk = Math.max(5, 100 - claudeWeeklyUsedPercent);

      if (
        activeSlot.pools.gemini.fiveHourRemaining !== newGemini5h ||
        activeSlot.pools.gemini.weeklyRemaining !== newGeminiWk ||
        activeSlot.pools.claude_gpt.fiveHourRemaining !== newClaude5h ||
        activeSlot.pools.claude_gpt.weeklyRemaining !== newClaudeWk
      ) {
        activeSlot.pools.gemini.fiveHourRemaining = newGemini5h;
        activeSlot.pools.gemini.weeklyRemaining = newGeminiWk;
        activeSlot.pools.claude_gpt.fiveHourRemaining = newClaude5h;
        activeSlot.pools.claude_gpt.weeklyRemaining = newClaudeWk;
        changed = true;
      }
    }

    // Auto-detect dynamic active model
    const currentActiveModel = getActiveModel();
    if (metadata.currentModel !== currentActiveModel) {
      metadata.currentModel = currentActiveModel;
      changed = true;
    }

    if (changed) {
      saveMetadata(metadata);
      this.ui.refresh();
    }
  }
}

// Tree View Components
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
    const tierInfo = getSlotTierInfo(slotData, isActive);

    const collapsibleState = isOccupied
      ? (isActive ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
      : vscode.TreeItemCollapsibleState.None;

    super(label, collapsibleState);

    this.slot = slotData.slot;
    this.slotData = slotData;
    this.isActive = isActive;
    this.isOccupied = isOccupied;
    this.poolData = poolData;
    this.tierInfo = tierInfo;

    const quotaSummary = (poolData.geminiUsed === poolData.claudeUsed)
      ? `${poolData.geminiUsed}% used`
      : `Gemini ${poolData.geminiUsed}% • Claude ${poolData.claudeUsed}% used`;

    if (isActive) {
      this.contextValue = "activeSlot";
      if (poolData.isRateLimited) {
        this.description = `● Active • ${tierInfo.tierBadge} • ⚠️ Rate Limited`;
        this.iconPath = new vscode.ThemeIcon("warning", new vscode.ThemeColor("problemsWarningIcon.foreground"));
      } else {
        this.description = `● Active • ${tierInfo.tierBadge} • ${quotaSummary}`;
        this.iconPath = new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("testing.iconPassed"));
      }
      this.tooltip = `Slot ${slotData.slot}: ${slotData.name}\nStatus: Active Account (Synced with IDE & App)\nPlan: ${tierInfo.tierName} (${tierInfo.tierBadge})\nActive Model: ${activeModel}\n\nQuotas:\n• Gemini Pool: ${poolData.gemini.weeklyRemaining}% Weekly | ${poolData.gemini.fiveHourRemaining}% 5h (${poolData.geminiUsed}% used)\n• Claude & GPT Pool: ${poolData.claudeGpt.weeklyRemaining}% Weekly | ${poolData.claudeGpt.fiveHourRemaining}% 5h (${poolData.claudeUsed}% used)\n\nBlended Average: ${poolData.overallUsedPercent}% Used (${poolData.overallPendingPercent}% Remaining)`;
    } else if (isOccupied) {
      this.contextValue = "occupiedSlot";
      if (poolData.isRateLimited) {
        this.description = `Ready • ${tierInfo.tierBadge} • ⚠️ Rate Limited`;
        this.iconPath = new vscode.ThemeIcon("warning", new vscode.ThemeColor("problemsWarningIcon.foreground"));
      } else {
        this.description = `Ready • ${tierInfo.tierBadge} • ${quotaSummary}`;
        this.iconPath = new vscode.ThemeIcon("account");
      }
      this.tooltip = `Slot ${slotData.slot}: ${slotData.name}\nStatus: Inactive Account (Click to Switch)\nPlan: ${tierInfo.tierName} (${tierInfo.tierBadge})\nQuotas: ${poolData.gemini.weeklyRemaining}% Gemini (${poolData.geminiUsed}% used) | ${poolData.claudeGpt.weeklyRemaining}% Claude & GPT (${poolData.claudeUsed}% used)`;
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
  constructor(activeModel, activeTierInfo) {
    const badgeText = activeTierInfo ? ` [${activeTierInfo.tierBadge}]` : "";
    super(`Active Model: ${activeModel}`, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "currentModelItem";
    this.description = `● In Use${badgeText}`;
    this.iconPath = new vscode.ThemeIcon("sparkle", new vscode.ThemeColor("charts.yellow"));
    this.tooltip = `Active Model in Antigravity: ${activeModel}\nCurrent Account Plan: ${activeTierInfo ? activeTierInfo.tierName : "Standard"}\nClick to change active AI model.`;
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
  constructor(slotData, poolKey, poolInfo, isActive, activeModel, tierInfo) {
    const isGemini = poolKey === "gemini";
    const label = `${poolInfo.name} (${poolInfo.weeklyRemaining}% Rem)`;
    const collapsibleState = isActive
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.Collapsed;
    super(label, collapsibleState);

    this.slot = slotData.slot;
    this.slotData = slotData;
    this.poolKey = poolKey;
    this.poolInfo = poolInfo;
    this.isActive = isActive;
    this.activeModel = activeModel;
    this.tierInfo = tierInfo;
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
  constructor(slotData, modelObj, isActive, activeModel, tierInfo) {
    const isCurrentModel = isActive && (
      modelObj.name.toLowerCase() === activeModel.toLowerCase() ||
      activeModel.toLowerCase() === modelObj.shortName.toLowerCase() ||
      (modelObj.name.includes("(High)") && (activeModel.toLowerCase() === "gemini 3.8 flash" || activeModel.toLowerCase() === "gemini 3.8"))
    );
    super(modelObj.name, vscode.TreeItemCollapsibleState.None);

    this.slot = slotData.slot;
    this.slotData = slotData;
    this.modelObj = modelObj;
    this.isCurrentModel = isCurrentModel;
    this.tierInfo = tierInfo;

    const availability = isModelAvailableForSlot(modelObj, tierInfo);
    this.availability = availability;

    const usageInfo = slotData && slotData.usage ? (slotData.usage[modelObj.name] || slotData.usage[modelObj.shortName]) : null;
    const reqText = usageInfo && usageInfo.used ? ` • ${usageInfo.used} req` : "";

    if (availability.isUnavailable || modelObj.status === "unavailable") {
      this.contextValue = "unavailableModelItem";
      this.description = `Notice: Unavailable (Upcoming Preview)`;
      this.iconPath = new vscode.ThemeIcon("circle-slash", new vscode.ThemeColor("disabledForeground"));
      this.tooltip = `Model: ${modelObj.name}\nStatus: Unavailable in Antigravity (Upcoming Preview)\nNotice: ${modelObj.unavailableReason || availability.reason || "This model is an upcoming preview and not yet available for generation in Google Antigravity."}`;
      this.command = {
        command: "antigravityProfilePilot.showModelTierInfo",
        title: "Model Availability Notice",
        arguments: [{ modelObj, slotData, tierInfo }]
      };
    } else if (!availability.available) {
      this.contextValue = "lockedModelItem";
      this.description = `🔒 ${availability.badge}${reqText}`;
      this.iconPath = new vscode.ThemeIcon("lock", new vscode.ThemeColor("disabledForeground"));
      this.tooltip = `Model: ${modelObj.name}\nStatus: 🔒 Locked (${availability.badge})\n${availability.reason}\nClick for Plan Tier details or to switch accounts.`;
      this.command = {
        command: "antigravityProfilePilot.showModelTierInfo",
        title: "View Plan Tier Info",
        arguments: [{ modelObj, slotData, tierInfo }]
      };
    } else if (isCurrentModel) {
      this.contextValue = "currentModelItem";
      this.description = `● Active (${modelObj.badge}${reqText})`;
      this.iconPath = new vscode.ThemeIcon("sparkle", new vscode.ThemeColor("charts.yellow"));
      this.tooltip = `Model: ${modelObj.name} [Available]\nBadge: ${modelObj.badge}${usageInfo ? `\nUsage: ${usageInfo.used} requests recorded` : ""}\nCurrently active in Antigravity.`;
      this.command = {
        command: "antigravityProfilePilot.selectActiveModel",
        title: "Set Active Model",
        arguments: [modelObj.name]
      };
    } else {
      this.contextValue = "availableItem";
      const noticeTag = modelObj.notice ? ` • Notice ℹ️` : "";
      this.description = `${modelObj.badge}${noticeTag}${reqText}`;
      this.iconPath = new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green"));
      this.tooltip = `Model: ${modelObj.name} [Available]\nBadge: ${modelObj.badge}${modelObj.notice ? `\nNotice: ${modelObj.notice}` : ""}${usageInfo ? `\nUsage: ${usageInfo.used} requests recorded` : ""}\nClick to set as active model.`;
      this.command = {
        command: "antigravityProfilePilot.selectActiveModel",
        title: "Set Active Model",
        arguments: [modelObj.name]
      };
    }
  }
}

class LegacyModelsGroupTreeItem extends vscode.TreeItem {
  constructor(slotData, poolKey, legacyModels, isActive, activeModel, tierInfo) {
    super(`Previous / Historical Models (${legacyModels.length})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.slotData = slotData;
    this.poolKey = poolKey;
    this.legacyModels = legacyModels;
    this.isActive = isActive;
    this.activeModel = activeModel;
    this.tierInfo = tierInfo;
    this.contextValue = "legacyModelsGroup";
    this.iconPath = new vscode.ThemeIcon("archive", new vscode.ThemeColor("disabledForeground"));
    this.description = "Older versions";
    this.tooltip = "Older or deprecated model versions detected in previous conversations or backups. Expand to view historical usage.";
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
    const dynamicCatalog = getDynamicModelCatalog(this);

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
      const tierInfo = element.tierInfo;
      const children = [];

      if (isActive) {
        children.push(new ActiveModelSummaryTreeItem(activeModel, tierInfo));
        children.push(new QuotaSummaryTreeItem(poolData));
        children.push(new PoolGroupTreeItem(slotData, "gemini", poolData.gemini, isActive, activeModel, tierInfo));
        children.push(new PoolGroupTreeItem(slotData, "claude_gpt", poolData.claudeGpt, isActive, activeModel, tierInfo));
      } else {
        children.push(new SwitchActionTreeItem(slotData));
        children.push(new PoolGroupTreeItem(slotData, "gemini", poolData.gemini, isActive, activeModel, tierInfo));
        children.push(new PoolGroupTreeItem(slotData, "claude_gpt", poolData.claudeGpt, isActive, activeModel, tierInfo));
      }

      return children;
    }

    if (element instanceof PoolGroupTreeItem) {
      const poolInfo = element.poolInfo;
      const poolKey = element.poolKey;
      const slotData = element.slotData;
      const isActive = element.isActive;
      const activeModel = element.activeModel;
      const tierInfo = element.tierInfo;
      const children = [];

      children.push(new QuotaMetricTreeItem("Weekly Limit", poolInfo.weeklyRemaining, "calendar"));
      children.push(new QuotaMetricTreeItem("Five Hour Limit", poolInfo.fiveHourRemaining, "clock"));

      const poolModels = dynamicCatalog.filter(m => m.pool === poolKey);
      const activeLineup = poolModels.filter(m => m.isCurrentLineup !== false);
      const legacyModels = poolModels.filter(m => m.isCurrentLineup === false);

      for (const m of activeLineup) {
        children.push(new AntigravityModelTreeItem(slotData, m, isActive, activeModel, tierInfo));
      }

      if (legacyModels.length > 0) {
        children.push(new LegacyModelsGroupTreeItem(slotData, poolKey, legacyModels, isActive, activeModel, tierInfo));
      }

      return children;
    }

    if (element instanceof LegacyModelsGroupTreeItem) {
      return element.legacyModels.map(m => new AntigravityModelTreeItem(
        element.slotData,
        m,
        element.isActive,
        element.activeModel,
        element.tierInfo
      ));
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
        const tierInfo = getSlotTierInfo(slotData, isActive);

        let icon = isActive ? "$(check)" : "$(account)";
        if (poolData.isRateLimited) {
          icon = "$(warning)";
        }

        btn.text = `${icon} ${i + 1}: ${shortenLabel(slotData.name)} (${poolData.overallUsedPercent}% used)`;
        
        if (poolData.isRateLimited) {
          btn.color = "#FF4444";
          btn.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        } else if (isActive) {
          btn.color = "#FFFFFF";
          btn.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        } else {
          btn.color = color;
          btn.backgroundColor = undefined;
        }

        btn.tooltip = `Slot ${i + 1}: ${slotData.name}${isActive ? ` (Active - Using ${activeModel})` : " - Click to Switch"}${poolData.isRateLimited ? " [RATE LIMITED]" : ""}\nPlan: ${tierInfo.tierName} (${tierInfo.tierBadge})\n\nQuotas:\n• Gemini: ${poolData.gemini.weeklyRemaining}% Wk | ${poolData.gemini.fiveHourRemaining}% 5h\n• Claude & GPT: ${poolData.claudeGpt.weeklyRemaining}% Wk | ${poolData.claudeGpt.fiveHourRemaining}% 5h\n\nOverall: ${poolData.overallUsedPercent}% Used (${poolData.overallPendingPercent}% Remaining)\nSaved: ${slotData.updatedAt || slotData.createdAt || "N/A"}`;
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

let activeUsageTracker = null;

function activate(context) {
  const treeDataProvider = new AccountSlotsTreeDataProvider();
  vscode.window.registerTreeDataProvider("antigravityProfilePilot.slotsView", treeDataProvider);

  const ui = new AccountSwitcherUI(context, treeDataProvider);

  // Initialize and start Auto Usage Tracker & Rate Limit Monitor
  activeUsageTracker = new AutoUsageTracker(context, ui);
  activeUsageTracker.start();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("antigravityProfilePilot")) {
        cachedDynamicModels = null;
        activeUsageTracker.start();
        ui.refresh();
      }
    })
  );

  // Add Custom Model Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.addCustomModel", async () => {
      const modelName = await vscode.window.showInputBox({
        prompt: "Enter AI Model Name to track dynamically",
        placeHolder: "e.g. Gemini 3.8 Flash (High) / Claude 3.7 Sonnet"
      });
      if (!modelName) return;

      addTrackedModel(modelName.trim());
      ui.refresh();
      vscode.window.showInformationMessage(`✓ Added "${modelName.trim()}" to dynamic tracker!`);
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
        const detectedEmail = detectLoggedInEmail();
        const defaultName = detectedEmail || `Account ${targetSlotNum}`;
        const profileName = await vscode.window.showInputBox({
          prompt: `Enter a friendly name or email for Slot ${targetSlotNum}`,
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
        `   • Give it a name or Google email address.\n\n` +
        `4. DUAL-APP INSTANT SWITCHING\n` +
        `   • Click any slot to switch with 1-click.\n` +
        `   • Swaps credentials across BOTH Antigravity IDE and Antigravity App automatically!\n\n` +
        `5. AUTO QUOTA & RATE LIMIT PROTECTION\n` +
        `   • Live monitoring detects 429 quota exhaustion and suggests instant 1-click switching.`;

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
      const dynamicCatalog = getDynamicModelCatalog();

      const breakdownLines = [];
      breakdownLines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      breakdownLines.push("           PROFILE PILOT: USAGE DRILL-DOWN         ");
      breakdownLines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      breakdownLines.push(`Active Model: ${activeModel}\n`);

      for (const slot of metadata.slots) {
        if (!slot.name) continue;
        const poolData = getSlotPoolData(slot);
        const isActive = slot.active || metadata.activeSlot === slot.slot;
        const tierInfo = getSlotTierInfo(slot, isActive);
        
        breakdownLines.push(`👤 Slot ${slot.slot}: ${slot.name}${isActive ? " (Active Session)" : ""} [Plan: ${tierInfo.tierName}]`);
        breakdownLines.push(`Plan Status: ${tierInfo.isProOrHigher ? "✅ Pro/Ultra Tier - All models unlocked" : "🔒 Free Tier - Gemini 3.8/3.7/3.6 require Pro subscription"}`);
        breakdownLines.push(`Overall Quota: ${renderProgressBar(poolData.overallUsedPercent, 12)} ${poolData.overallUsedPercent}% Used (${poolData.overallPendingPercent}% Remaining)`);
        if (poolData.isRateLimited) {
          breakdownLines.push(`⚠️ STATUS: RATE LIMITED (429 Resource Exhausted)`);
        }
        breakdownLines.push("");

        const gem = poolData.gemini;
        breakdownLines.push(`┌── 🌐 GEMINI MODELS ─────────────────────────────┐`);
        breakdownLines.push(`│  • Weekly Limit Remaining    : ${gem.weeklyRemaining}% ${renderProgressBar(100 - gem.weeklyRemaining, 8)}`);
        breakdownLines.push(`│  • Five Hour Limit Remaining : ${gem.fiveHourRemaining}% ${renderProgressBar(100 - gem.fiveHourRemaining, 8)}`);
        const geminiModels = dynamicCatalog.filter(m => m.pool === "gemini").map(m => m.shortName);
        const gemList = Array.from(new Set(geminiModels)).slice(0, 5).join(", ");
        breakdownLines.push(`│  Models: ${gemList}...`);
        breakdownLines.push(`└──────────────────────────────────────────────────┘\n`);

        const cg = poolData.claudeGpt;
        breakdownLines.push(`┌── 🤖 CLAUDE & GPT MODELS ───────────────────────┐`);
        breakdownLines.push(`│  • Weekly Limit Remaining    : ${cg.weeklyRemaining}% ${renderProgressBar(100 - cg.weeklyRemaining, 8)}`);
        breakdownLines.push(`│  • Five Hour Limit Remaining : ${cg.fiveHourRemaining}% ${renderProgressBar(100 - cg.fiveHourRemaining, 8)}`);
        const cgModels = dynamicCatalog.filter(m => m.pool === "claude_gpt").map(m => m.shortName);
        const cgList = Array.from(new Set(cgModels)).slice(0, 5).join(", ");
        breakdownLines.push(`│  Models: ${cgList}...`);
        breakdownLines.push(`└──────────────────────────────────────────────────┘\n`);

        if (slot.usage && Object.keys(slot.usage).length > 0) {
          breakdownLines.push(`  Turn & Request Breakdown:`);
          for (const [mName, u] of Object.entries(slot.usage)) {
            breakdownLines.push(`    • ${mName}: ${u.used} requests`);
          }
          breakdownLines.push("");
        }
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

  // Show Model Tier & Availability Details Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.showModelTierInfo", async arg => {
      let modelObj = null;
      let slotData = null;
      let tierInfo = null;

      if (arg && arg.modelObj) {
        modelObj = arg.modelObj;
        slotData = arg.slotData;
        tierInfo = arg.tierInfo;
      } else if (typeof arg === "string") {
        const dynamicCatalog = getDynamicModelCatalog();
        modelObj = dynamicCatalog.find(m => m.name === arg || m.shortName === arg) || classifyModel(arg);
      }

      const metadata = loadMetadata();
      const activeSlotNum = metadata.activeSlot || 1;
      const activeSlot = metadata.slots[activeSlotNum - 1];

      if (!slotData) slotData = activeSlot;
      if (!tierInfo) tierInfo = getSlotTierInfo(slotData, slotData && (slotData.active || metadata.activeSlot === slotData.slot));

      const modelName = modelObj ? modelObj.name : "This model";
      const availability = modelObj ? isModelAvailableForSlot(modelObj, tierInfo) : { available: true };

      // Find configured slots that have Pro, Ultra, or Paid tier
      const proSlots = metadata.slots.filter(s => {
        if (!s.name) return false;
        const sTier = getSlotTierInfo(s, s.slot === activeSlotNum);
        return sTier && sTier.isProOrHigher;
      });

      if (modelObj && (modelObj.status === "unavailable" || availability.isUnavailable)) {
        const detailMsg =
          `ℹ️ Model Availability Notice:\n\n` +
          `• Model: ${modelName}\n` +
          `• Status: Unavailable in Google Antigravity (Upcoming Preview)\n` +
          `• Notice: ${modelObj.unavailableReason || availability.reason || "Not yet available in Google Antigravity (Upcoming Preview)."}\n\n` +
          `Google Antigravity lists this model in its catalog as an upcoming preview. It is not currently available for prompt generation in any account tier.`;

        const choice = await vscode.window.showInformationMessage(
          `Notice: "${modelName}" is currently unavailable in Google Antigravity (Upcoming Preview).`,
          { modal: true, detail: detailMsg },
          "Select an Available Model",
          "Close"
        );

        if (choice === "Select an Available Model") {
          vscode.commands.executeCommand("antigravityProfilePilot.selectActiveModel");
        }
        return;
      }

      if (!availability.available) {
        const detailMsg =
          `🔒 Model Access Restricted:\n\n` +
          `• Model: ${modelName}\n` +
          `• Required Plan: Google AI Pro, Ultra, or Third-Party Paid Tier\n` +
          `• Selected Slot: Slot ${slotData ? slotData.slot : activeSlotNum} (${slotData && slotData.name ? slotData.name : "Active Session"})\n` +
          `• Current Plan: ${tierInfo.tierName} (${tierInfo.tierBadge})\n\n` +
          `Free tier accounts only include Gemini 3.5 Flash, Gemini 3.1 Pro, and Claude 4.6 Thinking.\n` +
          `Gemini 3.8 Flash, 3.7 Flash, and 3.6 Flash require a Google AI Pro, Ultra, or Third-Party Paid subscription.`;

        const options = [];
        for (const ps of proSlots) {
          if (slotData && ps.slot === slotData.slot) continue;
          options.push(`Switch to Slot ${ps.slot} (${ps.name}) [Pro/Paid]`);
        }
        options.push("Set Account as Third-Party Paid Tier", "Configure Plan Tier", "Select an Available Model", "Close");

        const choice = await vscode.window.showWarningMessage(
          `"${modelName}" requires a Google AI Pro, Ultra, or Third-Party Paid Tier.`,
          { modal: true, detail: detailMsg },
          ...options
        );

        if (choice && choice.startsWith("Switch to Slot ")) {
          const match = choice.match(/Switch to Slot (\d+)/);
          if (match) {
            vscode.commands.executeCommand("antigravityProfilePilot.switchProfileSlot", parseInt(match[1], 10));
          }
        } else if (choice === "Set Account as Third-Party Paid Tier") {
          slotData.customTier = "paid_third_party";
          saveMetadata(metadata);
          clearTierCache();
          ui.refresh();
          vscode.window.showInformationMessage(`✓ Set Slot ${slotData.slot} (${slotData.name}) to Third-Party Paid Tier! All models are now unlocked.`);
          if (modelObj) {
            vscode.commands.executeCommand("antigravityProfilePilot.selectActiveModel", modelObj.name);
          }
        } else if (choice === "Configure Plan Tier") {
          vscode.commands.executeCommand("antigravityProfilePilot.setSlotTier", slotData.slot);
        } else if (choice === "Select an Available Model") {
          vscode.commands.executeCommand("antigravityProfilePilot.selectActiveModel");
        }
      } else {
        const detailMsg =
          `✅ Model Available:\n\n` +
          `• Model: ${modelName}\n` +
          `• Selected Slot: Slot ${slotData ? slotData.slot : activeSlotNum} (${slotData && slotData.name ? slotData.name : "Active Session"})\n` +
          `• Plan: ${tierInfo.tierName} (${tierInfo.tierBadge})\n` +
          `• Status: Unlocked and ready to use!`;

        const choice = await vscode.window.showInformationMessage(
          `"${modelName}" is unlocked and available on ${tierInfo.tierName}!`,
          { modal: true, detail: detailMsg },
          "Set as Active Model",
          "Close"
        );

        if (choice === "Set as Active Model" && modelObj) {
          vscode.commands.executeCommand("antigravityProfilePilot.selectActiveModel", modelObj.name);
        }
      }
    })
  );

  // Set Account Plan Tier Command (Interactive & Context Menu)
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.setSlotTier", async itemOrSlot => {
      let slotNumber = parseSlotNumber(itemOrSlot);
      const metadata = loadMetadata();

      if (!slotNumber) {
        const slotItems = metadata.slots
          .filter(s => s.name)
          .map(s => {
            const currentTier = getSlotTierInfo(s, s.slot === (metadata.activeSlot || 1));
            return {
              label: `Slot ${s.slot}: ${s.name}`,
              description: `Current Plan: ${currentTier.tierName} (${currentTier.tierBadge})`,
              slot: s.slot
            };
          });

        if (slotItems.length === 0) {
          vscode.window.showInformationMessage("No configured account slots found. Add an account first.");
          return;
        }

        const pickedSlot = await vscode.window.showQuickPick(slotItems, {
          placeHolder: "Select which account slot to set the plan tier for"
        });
        if (!pickedSlot) return;
        slotNumber = pickedSlot.slot;
      }

      const targetSlot = metadata.slots[slotNumber - 1];
      if (!targetSlot) return;

      const currentTier = getSlotTierInfo(targetSlot, targetSlot.slot === (metadata.activeSlot || 1));

      const tierOptions = [
        {
          label: "⚡ Auto-Detect (Dynamic)",
          description: "Detect automatically from Antigravity session sync & model availability",
          tierId: "auto"
        },
        {
          label: "💳 Third-Party Paid Tier (Partner / Reseller)",
          description: "Paid subscription through a third-party reseller, partner, or institutional provider (All models unlocked)",
          tierId: "paid_third_party"
        },
        {
          label: "✨ Google AI Pro",
          description: "Google One AI Premium subscription ($20/mo - All models unlocked)",
          tierId: "g1-pro-tier"
        },
        {
          label: "🌟 Google AI Ultra",
          description: "Google AI Ultra highest capacity plan (All models unlocked)",
          tierId: "g1-ultra-tier"
        },
        {
          label: "🏢 Enterprise / Workspace (Teams)",
          description: "Corporate Google Workspace or Teams enterprise tier (All models unlocked)",
          tierId: "enterprise"
        },
        {
          label: "🔑 BYOK / Third-Party Custom API Tier",
          description: "Bring Your Own Key or custom third-party AI provider endpoints (All models unlocked)",
          tierId: "byok"
        },
        {
          label: "🆓 Free Tier",
          description: "Standard free Google account (Basic models only - Gemini 3.5, 3.1, Claude 4.6)",
          tierId: "free"
        }
      ];

      const chosenTier = await vscode.window.showQuickPick(tierOptions, {
        placeHolder: `Select Plan Tier for Slot ${slotNumber} (${targetSlot.name}) [Current: ${currentTier.tierName}]`
      });
      if (!chosenTier) return;

      targetSlot.customTier = chosenTier.tierId;
      targetSlot.updatedAt = new Date().toISOString();
      saveMetadata(metadata);
      clearTierCache();
      ui.refresh();

      vscode.window.showInformationMessage(
        `✓ Slot ${slotNumber} (${targetSlot.name}) set to "${chosenTier.label}". Models & quotas updated.`
      );
    })
  );

  // Select / Change Active Model Command
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.selectActiveModel", async directModel => {
      const metadata = loadMetadata();
      const activeSlotNum = metadata.activeSlot || 1;
      const activeSlot = metadata.slots[activeSlotNum - 1];
      const activeTierInfo = getSlotTierInfo(activeSlot, true);
      const dynamicCatalog = getDynamicModelCatalog();

      if (typeof directModel === "string" && directModel.length > 0) {
        const targetModelObj = dynamicCatalog.find(m => m.name === directModel || m.shortName === directModel) || classifyModel(directModel);
        const avail = isModelAvailableForSlot(targetModelObj, activeTierInfo);

        if (targetModelObj && (targetModelObj.status === "unavailable" || avail.isUnavailable)) {
          vscode.window.showInformationMessage(
            `Notice: "${directModel}" is currently unavailable in Google Antigravity (Upcoming Preview).`,
            { modal: true, detail: `Google Antigravity lists "${directModel}" as an upcoming preview model. It is not currently available for prompt generation in any account tier.` }
          );
          return;
        }

        if (!avail.available) {
          const proceed = await vscode.window.showWarningMessage(
            `⚠️ "${directModel}" requires a Google AI Pro, Ultra, or Third-Party Paid subscription.\nYour active account (${activeSlot && activeSlot.name ? activeSlot.name : "Slot " + activeSlotNum}) is currently identified as ${activeTierInfo.tierName}.`,
            "Select Anyway",
            "Set as Third-Party Paid Tier",
            "View Plan Tier Info",
            "Cancel"
          );
          if (proceed === "Set as Third-Party Paid Tier" && activeSlot) {
            activeSlot.customTier = "paid_third_party";
            saveMetadata(metadata);
            clearTierCache();
            ui.refresh();
            setActiveModel(directModel);
            vscode.window.showInformationMessage(`✓ Set active account to Third-Party Paid Tier and activated "${directModel}"!`);
            return;
          }
          if (proceed === "View Plan Tier Info") {
            vscode.commands.executeCommand("antigravityProfilePilot.showModelTierInfo", { modelObj: targetModelObj, slotData: activeSlot, tierInfo: activeTierInfo });
            return;
          }
          if (proceed !== "Select Anyway") return;
        }

        setActiveModel(directModel);
        ui.refresh();
        vscode.window.showInformationMessage(`✓ Active model set to ${directModel}`);
        return;
      }

      const current = getActiveModel();

      const modelOptions = dynamicCatalog.map(m => {
        const avail = isModelAvailableForSlot(m, activeTierInfo);
        const isUnavailable = avail.isUnavailable || m.status === "unavailable";
        const isCurrent = m.name.toLowerCase() === current.toLowerCase() ||
          current.toLowerCase() === m.shortName.toLowerCase() ||
          (m.name.includes("(High)") && (current.toLowerCase() === "gemini 3.8 flash" || current.toLowerCase() === "gemini 3.8"));

        let label = "";
        let description = "";

        if (isCurrent) {
          label = `✓ ${m.name}`;
          description = `(${m.badge}) [Currently Active]`;
        } else if (isUnavailable) {
          label = `🚫 ${m.name}`;
          description = `Notice: Unavailable (Upcoming Preview)`;
        } else if (!avail.available) {
          label = `🔒 ${m.name}`;
          description = `(${m.badge}) [Requires Pro/Paid Tier]`;
        } else {
          const noticeTag = m.notice ? ` • Notice ℹ️ (${m.notice})` : "";
          label = `  ${m.name}`;
          description = `(${m.badge})${noticeTag} [Available]`;
        }

        return {
          label,
          description,
          detail: isUnavailable
            ? `Notice: ${m.unavailableReason || "Upcoming preview model, not yet available for generation."}`
            : (!avail.available ? avail.reason : `${m.pool === "gemini" ? "Gemini Models Pool" : "Claude & GPT Pool"}`),
          model: m.name,
          available: avail.available,
          isUnavailable,
          modelObj: m
        };
      });

      modelOptions.push({
        label: "$(plus) Custom Model...",
        description: "Add a custom model name or endpoint",
        model: "Custom Model...",
        available: true
      });

      const chosen = await vscode.window.showQuickPick(modelOptions, {
        placeHolder: `Select active model in Antigravity (Current: ${current} • Account Plan: ${activeTierInfo.tierName})`
      });
      if (!chosen) return;

      let selectedModel = chosen.model;
      if (selectedModel === "Custom Model...") {
        const input = await vscode.window.showInputBox({
          prompt: "Enter custom model name",
          placeHolder: "e.g. Gemini 3.8 Flash (High) / Claude 3.7 / DeepSeek R1"
        });
        if (!input) return;
        selectedModel = input.trim();
      } else if (chosen.isUnavailable || (chosen.modelObj && chosen.modelObj.status === "unavailable")) {
        vscode.window.showInformationMessage(
          `Notice: "${selectedModel}" is currently unavailable in Google Antigravity (Upcoming Preview).`,
          { modal: true, detail: `Google Antigravity lists "${selectedModel}" as an upcoming preview model. It is not currently available for prompt generation in any account tier.` }
        );
        return;
      } else if (!chosen.available && chosen.modelObj) {
        const choice = await vscode.window.showWarningMessage(
          `"${chosen.model}" requires Google AI Pro, Ultra, or a Third-Party Paid Tier.\nYour active account (${activeSlot && activeSlot.name ? activeSlot.name : "Slot " + activeSlotNum}) is currently identified as ${activeTierInfo.tierName}.`,
          "Select Anyway",
          "Set as Third-Party Paid Tier",
          "View Tier Info",
          "Cancel"
        );
        if (choice === "Set as Third-Party Paid Tier" && activeSlot) {
          activeSlot.customTier = "paid_third_party";
          saveMetadata(metadata);
          clearTierCache();
          ui.refresh();
          setActiveModel(selectedModel);
          vscode.window.showInformationMessage(`✓ Set active account to Third-Party Paid Tier and activated "${selectedModel}"!`);
          return;
        }
        if (choice === "View Tier Info") {
          vscode.commands.executeCommand("antigravityProfilePilot.showModelTierInfo", { modelObj: chosen.modelObj, slotData: activeSlot, tierInfo: activeTierInfo });
          return;
        }
        if (choice !== "Select Anyway") return;
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
      const detectedEmail = detectLoggedInEmail();
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

      const defaultName = selectedSlot.currentName || detectedEmail || `Account ${selectedSlot.slot}`;
      const profileName = await vscode.window.showInputBox({
        prompt: `Enter a name or email for Slot ${selectedSlot.slot}`,
        value: defaultName,
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

  // Save Current Session to Specific Slot
  context.subscriptions.push(
    vscode.commands.registerCommand("antigravityProfilePilot.saveToSpecificSlot", async itemOrSlot => {
      let slotNumber = parseSlotNumber(itemOrSlot);

      if (!slotNumber) {
        return vscode.commands.executeCommand("antigravityProfilePilot.addNewAccountWizard");
      }

      const metadata = loadMetadata();
      const detectedEmail = detectLoggedInEmail();
      const currentSlot = metadata.slots[slotNumber - 1];
      const defaultName = currentSlot && currentSlot.name ? currentSlot.name : (detectedEmail || `Account ${slotNumber}`);

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

  // Switch Profile Slot Direct Command
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

  // Delete Profile Command
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
    vscode.commands.registerCommand("antigravityProfilePilot.refreshSlots", async () => {
      if (activeUsageTracker) {
        await activeUsageTracker.tick().catch(() => {});
      }
      ui.refresh();
      vscode.window.setStatusBarMessage("$(check) Profile Pilot account quotas & dynamic model catalog refreshed", 2500);
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

function deactivate() {
  if (activeUsageTracker) {
    activeUsageTracker.stop();
    activeUsageTracker = null;
  }
}

module.exports = {
  activate,
  deactivate
};
