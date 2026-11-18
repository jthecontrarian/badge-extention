// BTC Price Badge - background service worker (Manifest V3)

const ALARM_NAME = "btc-refresh";
const REFRESH_MINUTES = 1; // CoinGecko's free tier is rate limited, so poll once a minute
const DEFAULT_CURRENCY = "USD";

// Fixed badge colour. Change this hex value to restyle the badge.
const BADGE_COLOR = "#475569";
const ERROR_COLOR = "#6b7280";

// Format a price so it fits the ~4 character badge.
function badgeText(price) {
  if (price >= 100000) return Math.round(price / 1000) + "k"; // 112k
  if (price >= 10000) return (price / 1000).toFixed(1) + "k"; // 98.4k
  if (price >= 1000) return (price / 1000).toFixed(2) + "k"; // 1.25k
  return String(Math.round(price));
}

async function fetchPrice(currency) {
  const vs = currency.toLowerCase();
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${vs}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`); // 429 = rate limited
  const json = await res.json();
  const amount = Number(json?.bitcoin?.[vs]);
  if (!Number.isFinite(amount)) throw new Error("Bad price payload");
  return amount;
}

async function update() {
  const { currency = DEFAULT_CURRENCY, lastPrice } = await chrome.storage.local.get([
    "currency",
    "lastPrice",
  ]);

  try {
    const price = await fetchPrice(currency);

    const color = BADGE_COLOR;

    await chrome.storage.local.set({
      lastPrice: price,
      lastUpdated: Date.now(),
      lastError: null,
      priceCurrency: currency,
    });

    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeTextColor?.({ color: "#ffffff" });
    await chrome.action.setBadgeText({ text: badgeText(price) });
    await chrome.action.setTitle({
      title: `BTC: ${price.toLocaleString(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      })}`,
    });
  } catch (err) {
    await chrome.storage.local.set({ lastError: String(err) });
    await chrome.action.setBadgeBackgroundColor({ color: ERROR_COLOR });
    await chrome.action.setBadgeText({ text: "?" });
    await chrome.action.setTitle({ title: "BTC Price: could not fetch (will retry)" });
  }
}

function schedule() {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: REFRESH_MINUTES });
}

chrome.runtime.onInstalled.addListener(() => {
  schedule();
  update();
});

chrome.runtime.onStartup.addListener(() => {
  schedule();
  update();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) update();
});

// Popup can ask for an immediate refresh (e.g. after changing currency).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "refresh") {
    // Reset the comparison baseline when the currency changes.
    const reset = msg.resetBaseline ? chrome.storage.local.remove(["lastPrice", "lastColor"]) : Promise.resolve();
    reset.then(update).then(() => sendResponse({ ok: true }));
    return true; // async response
  }
});
