// opencode CLI notification plugin.
// Install location: ~/.config/opencode/plugins/bridgespace-notify.js

import { spawn } from "node:child_process";

const HELPER = "C:/Users/savas/.bridgespace/bin/bs-agent-notify.cjs";
const DEBOUNCE_MS = 3000;
const recentNotifications = new Map();

function sanitize(value, max = 200) {
  return String(value ?? "")
    .replace(/[\x00-\x1f\x7f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function quotePowerShell(value) {
  return sanitize(value).replace(/'/g, "''");
}

function spawnDetached(file, args) {
  try {
    const child = spawn(file, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch {}
}

function notifyBridgeSpace(event, title, body) {
  spawnDetached("node", [
    HELPER,
    "--agent",
    "opencode",
    "--event",
    event,
    "--title",
    sanitize(title),
    "--body",
    sanitize(body, 1000),
  ]);
}

function notifyWindows(title, body) {
  if (process.platform !== "win32") return;

  const ps = `
try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $notify = New-Object System.Windows.Forms.NotifyIcon
  $notify.Icon = [System.Drawing.SystemIcons]::Information
  $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
  $notify.BalloonTipTitle = '${quotePowerShell(title)}'
  $notify.BalloonTipText = '${quotePowerShell(body)}'
  $notify.Visible = $true
  $notify.ShowBalloonTip(5000)
  Start-Sleep -Milliseconds 5500
  $notify.Dispose()
} catch {}
`.trim();

  const encoded = Buffer.from(ps, "utf16le").toString("base64");
  spawnDetached("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-STA",
    "-WindowStyle",
    "Hidden",
    "-EncodedCommand",
    encoded,
  ]);
}

function notify(kind, title, body, event) {
  const sessionID = event?.properties?.sessionID ?? "unknown-session";
  const eventID = event?.properties?.id ?? event?.id ?? event?.type ?? kind;
  const key = `${kind}:${sessionID}:${eventID}`;
  const now = Date.now();
  const last = recentNotifications.get(key) ?? 0;
  if (now - last < DEBOUNCE_MS) return;
  recentNotifications.set(key, now);

  notifyBridgeSpace(kind, title, body);

  if (!process.env.BRIDGESPACE_SESSION_ID) {
    notifyWindows(title, body);
  }
}

export const BridgeSpaceNotifyPlugin = async () => {
  return {
    event: async ({ event }) => {
      const type = event?.type ?? "";

      if (type === "session.idle") {
        notify("stop", "opencode", "Cevap hazir.", event);
      }

      if (
        type === "question.asked" ||
        type === "question.v2.asked" ||
        type === "permission.asked" ||
        type === "permission.v2.asked"
      ) {
        notify("needs-input", "opencode", "Soru veya izin bekliyor.", event);
      }

      if (type === "session.error") {
        notify("error", "opencode", "Oturum hata verdi.", event);
      }
    },
  };
};
