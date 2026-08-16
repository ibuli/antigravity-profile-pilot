# Antigravity Multi-Account Switcher (macOS Native)

Seamlessly switch between multiple Google accounts in Antigravity IDE on macOS to bypass Gemini/Claude rate limits without manual re-login.

## 🚀 Highlights of macOS Native Version

- **100% Pure Node.js**: No PowerShell or external script dependencies needed.
- **Native macOS Paths**: Automatically stores and reads session tokens from `~/Library/Application Support/Antigravity`.
- **Status Bar Integration**: Visual profile indicators with 5 customizable slots and colors.
- **One-Click Switching**: Seamlessly swaps session databases and reloads the window.
- **Auto Rate-Limit Detection**: Continuously monitors Antigravity logs for 429 quota errors and prompts a quick switch.

---

## 📦 Quick Installation

Run the included installer script in Terminal:

```bash
./install.sh
```

Or manually copy the folder:

```bash
mkdir -p ~/.antigravity/extensions/antigravity-account-switcher-2.1.0
cp package.json extension.js ~/.antigravity/extensions/antigravity-account-switcher-2.1.0/
```

Then restart **Antigravity IDE** or press `Cmd + Shift + P` -> **Developer: Reload Window**.

---

## 🎯 How to Use

### 1. Save Your First Account
1. Log in with your **Account 1** in Antigravity.
2. In the bottom-right status bar, click **`+ Save Account`** (or open Command Palette: `Antigravity: Save Current Profile`).
3. Select **Slot 1** and enter a label (e.g., `Personal` or `Account 1`).

### 2. Save Your Other Accounts (Up to 5 Slots)
1. Log out from Antigravity and sign in with your **Account 2**.
2. Click **`+ Save Account`**.
3. Select **Slot 2** and name it (e.g., `Work` or `Backup`).

### 3. Switch Between Accounts
- Simply click any configured slot button in the status bar (e.g. `[1: Personal]`, `[2: Work]`).
- Or open Command Palette (`Cmd + Shift + P`) and select `Antigravity: Switch Profile`.
- The IDE will instantly restore the chosen account's authentication and reload.
