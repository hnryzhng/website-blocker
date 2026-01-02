const STORAGE_KEY = "blockedSites";

let blockedDomains = null;
let loadPromise = null;

// Normalize a site / URL into a domain:
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
  // console.log("Loaded blocked domains:", blockedDomains);
}

// Ensure blocklist is loaded whenever we need it
async function ensureBlocklistLoaded() {
  // Already loaded in this worker instance
  if (blockedDomains !== null) return;

  // One in-flight load only
  if (!loadPromise) {
    loadPromise = loadBlocklistFromStorage().finally(() => {
      loadPromise = null;
    });
  }
  await loadPromise;
}

function isBlockedUrl(url) {
  if (!blockedDomains || blockedDomains.length === 0) return false;

  let hostname;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch (e) {
    return false;
  }

  // Remove leading www.
  hostname = hostname.replace(/^www\./i, "");

  // Block if hostname is domain or subdomain of a blocked domain
  return blockedDomains.some(domain => {
    return (
      hostname === domain ||
      hostname.endsWith("." + domain)
    );
  });
}

// When navigation starts, if URL is blocked, redirect the tab
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only care about top-level frame (frameId === 0)
  if (details.frameId !== 0) return;

  const url = details.url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;

  // Make sure we have the latest blocklist in *this* worker instance, so the blockedDomains in localStorage isn't re-initialized to empty array upon every service worker restart
  await ensureBlocklistLoaded();

  if (isBlockedUrl(url)) {
    const blockedPageUrl =
      chrome.runtime.getURL("blocked.html") +
      "?blocked=" + encodeURIComponent(url);

    try {
      await chrome.tabs.update(details.tabId, { url: blockedPageUrl });
    } catch (e) {
      // Tab might be gone; ignore
    }
  }
});

// Optional: initial load on install/startup
chrome.runtime.onInstalled.addListener(() => {
  blockedDomains = null; // force reload next time it's needed
});
chrome.runtime.onStartup.addListener(() => {
  blockedDomains = null; // force reload next time it's needed
});

// When options change, invalidate the cached list
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[STORAGE_KEY]) {
    blockedDomains = null; // will be reloaded on next navigation
  }
});
