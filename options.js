const STORAGE_KEY = "blockedSites";

const listEl = document.getElementById("list");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

function linesToArray(text) {
  return text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
}

async function load() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  const arr = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  listEl.value = arr.join("\n");
}

async function save() {
  const sites = linesToArray(listEl.value);
  await chrome.storage.sync.set({ [STORAGE_KEY]: sites });
  statusEl.textContent = "Saved!";
  setTimeout(() => (statusEl.textContent = ""), 1200);
}

saveBtn.addEventListener("click", save);

load();
