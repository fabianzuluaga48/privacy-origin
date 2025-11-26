// Background Service Worker

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    networkRequests: [],
    cookies: [],
    geolocationAttempts: [],
    formData: [],
    globalStats: {
      trackers: {}, // { "google.com": { count: 0, sites: [] } }
      websitesVisited: []
    }
  });
  console.log("Privacy Extension Installed");
});

// Helper to update global stats
function updateGlobalStats(trackerDomain, currentSite) {
  if (!trackerDomain || !currentSite || trackerDomain === currentSite) return;

  chrome.storage.local.get(['globalStats'], (result) => {
    const stats = result.globalStats || { trackers: {}, websitesVisited: [] };

    // Update Tracker Stats
    if (!stats.trackers[trackerDomain]) {
      stats.trackers[trackerDomain] = { count: 0, sites: [] };
    }
    stats.trackers[trackerDomain].count++;
    if (!stats.trackers[trackerDomain].sites.includes(currentSite)) {
      stats.trackers[trackerDomain].sites.push(currentSite);
    }

    // Update Websites Visited
    if (!stats.websitesVisited.includes(currentSite)) {
      stats.websitesVisited.push(currentSite);
    }

    chrome.storage.local.set({ globalStats: stats });
  });
}

// Clear data for a tab when it navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    chrome.storage.local.get(['networkRequests', 'cookies', 'geolocationAttempts', 'formData'], (result) => {
      const clean = (arr) => (arr || []).filter(item => item.tabId !== tabId);

      chrome.storage.local.set({
        networkRequests: clean(result.networkRequests),
        cookies: clean(result.cookies),
        geolocationAttempts: clean(result.geolocationAttempts),
        formData: clean(result.formData)
      });
    });
  }
});

// Network Request Monitoring (Reference: uBlock/src/js/traffic.js)
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId === -1) return; // Ignore background requests

    // Log the request
    const logEntry = {
      url: details.url,
      type: details.type,
      initiator: details.initiator,
      tabId: details.tabId,
      timeStamp: Date.now()
    };

    // Global Stats Aggregation
    try {
      const trackerHost = new URL(details.url).hostname;
      const initiatorHost = details.initiator ? new URL(details.initiator).hostname : null;
      if (initiatorHost && !trackerHost.includes(initiatorHost)) {
        updateGlobalStats(trackerHost, initiatorHost);
      }
    } catch (e) { }

    // Store in local storage (limit to last 100 for performance)
    chrome.storage.local.get(['networkRequests'], (result) => {
      const requests = result.networkRequests || [];
      requests.push(logEntry);
      // Removed hard limit of 100, but let's keep a safety cap of 2000 to prevent memory issues
      if (requests.length > 2000) requests.shift();
      chrome.storage.local.set({ networkRequests: requests });
    });
  },
  { urls: ["<all_urls>"] }
);

// Cookie Monitoring (Reference: uBlock/src/js/httpheader-filtering.js)
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId === -1) return;

    if (details.responseHeaders) {
      details.responseHeaders.forEach((header) => {
        if (header.name.toLowerCase() === 'set-cookie') {
          // Basic 3rd party check
          const initiator = details.initiator ? new URL(details.initiator).hostname : 'unknown';
          let url = 'unknown';
          try {
            url = new URL(details.url).hostname;
          } catch (e) { }

          // If initiator domain doesn't match request domain, it's likely 3rd party
          const isThirdParty = initiator !== 'unknown' && url !== 'unknown' && !url.includes(initiator);

          if (isThirdParty) {
            updateGlobalStats(url, initiator);
          }

          const logEntry = {
            url: details.url,
            cookie: header.value,
            isThirdParty: isThirdParty,
            tabId: details.tabId,
            timeStamp: Date.now()
          };

          chrome.storage.local.get(['cookies'], (result) => {
            const cookies = result.cookies || [];
            // Avoid duplicates for the same URL/Cookie combo to keep list clean
            const exists = cookies.some(c => c.url === logEntry.url && c.cookie === logEntry.cookie && c.tabId === logEntry.tabId);
            if (!exists) {
              cookies.push(logEntry);
              if (cookies.length > 2000) cookies.shift();
              chrome.storage.local.set({ cookies: cookies });
            }
          });
        }
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
);

// Listen for messages from content script (Geolocation & Forms)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.tab) return;

  if (message.type === 'GEOLOCATION_ATTEMPT') {
    chrome.storage.local.get(['geolocationAttempts'], (result) => {
      const attempts = result.geolocationAttempts || [];
      attempts.push({
        url: sender.tab.url,
        tabId: sender.tab.id,
        timeStamp: Date.now()
      });
      chrome.storage.local.set({ geolocationAttempts: attempts });
    });
  } else if (message.type === 'FORM_SUBMISSION') {
    chrome.storage.local.get(['formData'], (result) => {
      const data = result.formData || [];
      data.push({
        url: sender.tab.url,
        action: message.action, // 'submit' or 'input'
        tabId: sender.tab.id,
        timeStamp: Date.now()
      });
      chrome.storage.local.set({ formData: data });
    });
  }
});
