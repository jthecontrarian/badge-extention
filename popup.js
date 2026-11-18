const priceEl = document.getElementById("price");
const metaEl = document.getElementById("meta");
const currencyEl = document.getElementById("currency");
const refreshBtn = document.getElementById("refresh");

function timeAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

async function render() {
  const data = await chrome.storage.local.get([
    "lastPrice",
    "lastUpdated",
    "lastError",
    "currency",
    "priceCurrency",
  ]);

  currencyEl.value = data.currency || "USD";
  metaEl.classList.remove("error");

  if (typeof data.lastPrice === "number") {
    priceEl.textContent = data.lastPrice.toLocaleString(undefined, {
      style: "currency",
      currency: data.priceCurrency || data.currency || "USD",
      maximumFractionDigits: 2,
    });
    metaEl.textContent = data.lastUpdated ? `Updated ${timeAgo(data.lastUpdated)}` : "";
  } else {
    priceEl.textContent = "--";
    metaEl.textContent = "Fetching price...";
  }

  if (data.lastError) {
    metaEl.textContent = "Couldn't fetch price. Retrying...";
    metaEl.classList.add("error");
  }
}

async function refresh(resetBaseline = false) {
  refreshBtn.disabled = true;
  await chrome.runtime.sendMessage({ type: "refresh", resetBaseline });
  await render();
  refreshBtn.disabled = false;
}

currencyEl.addEventListener("change", async () => {
  await chrome.storage.local.set({ currency: currencyEl.value });
  refresh(true);
});

refreshBtn.addEventListener("click", () => refresh(false));

render();
setInterval(render, 5000);
