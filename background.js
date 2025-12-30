const STORAGE_KEY = "blockedSites";

let blockedDomains = [];

// Normalize a site URL into a valid domain
//  - trim
//  - strip protocol, path, port
//  - remove leading www.

function normalizeSite(input) {
  let s = (input || "").trim();
  if (!s) return "";

  s = s.replace(/^https?:\/\//i, "");
  s = s.split("/")[0];
  s = s.split(":")[0];
  s = s.replace(/^www\./i, "");

  return s.toLowerCase();
}

async function loadBlocklistFromStorage() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  const raw = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  const normalized = raw.map(normalizeSite).filter(Boolean);
  blockedDomains = [...new Set(normalized)];
  // For debugging: uncomment next line and check chrome://extensions -> Service worker
  // console.log("Blocked domains:", blockedDomains);
}

function isBlockedUrl(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch (e) {
    return false;
  }

  // remove leading www.
  hostname = hostname.replace(/^www\./i, "");

  // block if hostname is domain or subdomain of a blocked domain
  return blockedDomains.some(domain => {
    return (
      hostname === domain ||
      hostname.endsWith("." + domain)
    );
  });
}

// when navigation starts, if URL is blocked, redirect the tab
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // only care about top-level frame (frameId === 0)
  if (details.frameId !== 0) return;

  const url = details.url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;

  if (isBlockedUrl(url)) {
    const blockedPageUrl =
      chrome.runtime.getURL("blocked.html") +
      "?blocked=" + encodeURIComponent(url);

    try {
      await chrome.tabs.update(details.tabId, { url: blockedPageUrl });
    } catch (e) {
      // tab might be gone; ignore
    }
  }
});

// initial load of blocklist
chrome.runtime.onInstalled.addListener(loadBlocklistFromStorage);
chrome.runtime.onStartup.addListener(loadBlocklistFromStorage);

// update in memory when options change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[STORAGE_KEY]) {
    loadBlocklistFromStorage();
  }
});
