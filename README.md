# Profile Pilot for Antigravity (macOS & Windows)

A smart, native, zero-dependency multi-account profile pilot and quota manager for **Google Antigravity IDE** and the **Antigravity Companion App** on **macOS** and **Windows**. Seamlessly switch between multiple Google accounts with 1-click to bypass Gemini and Claude rate limits without repeated log-ins.

---

## 🚀 Key Features

- **Activity Bar Sidebar (Profile Pilot)**: Dedicated sidebar panel displaying all configured account profile slots, active session badges, and collapsible quota pools.
- **Exact Antigravity AI Model Suite**:
  - `Gemini 3.7 Flash Medium` (Fast)
  - `Gemini 3.6 Flash Medium` (Fast)
  - `Gemini 3.5 Flash Medium` (Fast)
  - `Gemini 3.1 Pro Low` (Standard)
  - `Claude Sonnet 4.6 (Thinking)` (Deep Reasoning)
  - `Claude Opus 4.6 (Thinking)` (Deep Reasoning)
  - `GPT-OSS 120B (Medium)` (Open Weights)
- **Dual-Pool Usage & Quota Drill-Down**:
  - **🌐 Gemini Models Pool**: Weekly Limit Remaining & 5-Hour Rolling Limit.
  - **🤖 Claude & GPT Models Pool**: Weekly Limit Remaining & 5-Hour Rolling Limit.
  - Interactive drill-down modal with real-time percentage indicators.
- **Dual-App Synchronization**: Swapping accounts in Antigravity IDE automatically updates credentials in the standalone Antigravity App simultaneously.
- **Per-Slot Quota Isolation**: Freshly added accounts start with independent 100% available quotas.
- **Guided Setup Wizard**: 3-step interactive dialog making it effortless to add and link secondary Google accounts safely without losing active work.
- **Status Bar Integration**: Visual profile buttons in the status bar with 1-click switching.
- **Cross-Platform**: First-class support for **macOS (Apple Silicon & Intel)** and **Windows (10/11)**.

---

## 📦 Installation

### macOS / Linux:
Run the install script in Terminal:
```bash
./install.sh
```

### Windows (PowerShell / Command Prompt):
Run the installer script in PowerShell or Command Prompt:
```powershell
.\install.ps1
```
*(Or double-click `install.bat`)*

Then reload Antigravity IDE (`Cmd + Shift + P` / `Ctrl + Shift + P` -> **Developer: Reload Window**).

---

## 🎯 How to Use

### 1. Adding a Second Account:
1. Click **`➕ Add / Link Another Google Account`** in the sidebar (or click any empty slot like `➕ Slot 2: Add Account 2`).
2. Follow the 3-step wizard:
   - Your current account is safely preserved.
   - Sign out and log in with your 2nd Google account in the browser.
   - Click **`[Save Current Session to Slot 2]`** and give it a label (e.g. *Work* or *Secondary*).

### 2. Switching Accounts:
- Simply click any saved slot in the **Sidebar** or **Status Bar** to switch instantly.
- Both Antigravity IDE and App switch seamlessly without requiring you to re-authenticate!

### 3. Monitoring Quotas & Active Models:
- Click **`📊 Usage & Quotas`** in the sidebar to open the full drill-down dialog.
- Click **`Active Model`** or any model item to change your active AI model on the fly.

---

## ⚙️ Extension Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `antigravityProfilePilot.maxProfiles` | `5` | Maximum number of account profile slots (1–5). |
| `antigravityProfilePilot.customModels` | `[]` | Array of custom model names or endpoints to monitor. |
| `antigravityProfilePilot.rateLimitMonitor.enabled` | `true` | Enable background log scanning for 429 quota alerts. |
| `antigravityProfilePilot.rateLimitMonitor.scanIntervalSeconds` | `15` | Log scan interval in seconds. |

---

## 📄 License
MIT License.
