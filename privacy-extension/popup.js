// Popup Logic

// Known trackers for display
const KNOWN_TRACKERS = {
  'google-analytics.com': { name: 'Google Analytics', category: 'analytics' },
  'googletagmanager.com': { name: 'Google Tag Manager', category: 'analytics' },
  'facebook.net': { name: 'Facebook Pixel', category: 'social' },
  'facebook.com': { name: 'Facebook', category: 'social' },
  'doubleclick.net': { name: 'Google Ads', category: 'advertising' },
  'googlesyndication.com': { name: 'Google Ads', category: 'advertising' },
  'amazon-adsystem.com': { name: 'Amazon Ads', category: 'advertising' },
  'criteo.com': { name: 'Criteo', category: 'advertising' },
  'hotjar.com': { name: 'Hotjar', category: 'analytics' },
  'mixpanel.com': { name: 'Mixpanel', category: 'analytics' },
  'clarity.ms': { name: 'Microsoft Clarity', category: 'analytics' },
  'linkedin.com': { name: 'LinkedIn Insight', category: 'social' },
  'twitter.com': { name: 'Twitter/X Pixel', category: 'social' },
  'tiktok.com': { name: 'TikTok Pixel', category: 'social' }
};

function getTrackerInfo(hostname) {
  for (const [domain, info] of Object.entries(KNOWN_TRACKERS)) {
    if (hostname.includes(domain)) {
      return { domain, ...info };
    }
  }
  return null;
}

// Graph incerementation logic 
function chooseBucketConfig(tabAgeMs) {
  const hour = 3600_000;
  const day = 24 * hour;

  if (tabAgeMs <= 4 * hour) {
    const bucketSizeMs = hour;
    const numBuckets = Math.max(1, Math.ceil(tabAgeMs / bucketSizeMs));
    return { bucketSizeMs, numBuckets };
  }

  if (tabAgeMs <= 24 * hour) {
    const bucketSizeMs = 4 * hour;
    const numBuckets = Math.max(1, Math.ceil(tabAgeMs / bucketSizeMs));
    return { bucketSizeMs, numBuckets };
  }

  if (tabAgeMs <= 7 * day) {
    const bucketSizeMs = day;
    const numBuckets = Math.max(1, Math.ceil(tabAgeMs / bucketSizeMs));
    return { bucketSizeMs, numBuckets };
  }

  return { bucketSizeMs: day, numBuckets: 7 };
}

function computeBuckets(requests) {
  const now = Date.now();

  let startTs = now;
  if ((requests || []).length > 0) {
    startTs = Math.min(...requests.map(r => r.timeStamp));
  } else {
    startTs = now - 3600_000; // fallback: last 1 hour
  }

  const duration = Math.max(1, now - startTs);
  const { bucketSizeMs, numBuckets } = chooseBucketConfig(duration);

  const alignedStart = Math.floor(startTs / bucketSizeMs) * bucketSizeMs;
  const buckets = new Array(numBuckets).fill(0);

  requests.forEach((r) => {
    if (!r.timeStamp) return;
    let idx = Math.floor((r.timeStamp - alignedStart) / bucketSizeMs);
    if (idx < 0) idx = 0;
    if (idx >= numBuckets) idx = numBuckets - 1;
    buckets[idx]++;
  });

  const labels = buckets.map((_, i) => {
    const bucketStart = alignedStart + i * bucketSizeMs;
    const bucketStartDt = new Date(bucketStart);

    if (bucketSizeMs < 24 * 3600_000) {
      return bucketStartDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return bucketStartDt.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  });

  return { buckets, labels, startTs: alignedStart, bucketSizeMs };
}


function renderNetworkGraph(buckets, labels, bucketSizeMs) {
  const container = document.getElementById('network-graph');
  const legend = document.getElementById('network-graph-legend');

  if (!container || !legend) return;

  container.innerHTML = '';
  legend.innerHTML = '';

  const max = Math.max(1, ...buckets);
  const barMaxHeight = 56;

  buckets.forEach((count, i) => {
    const h = Math.round((count / max) * barMaxHeight) + 8;
    const bar = document.createElement('div');
    bar.className = 'ng-bar';
    bar.style.height = `${h}px`;
    bar.dataset.count = count;
    bar.dataset.label = labels[i];

    const tip = document.createElement('div');
    tip.className = 'ng-tooltip';
    tip.textContent = `${labels[i]} — ${count} req${count === 1 ? '' : 's'}`;
    bar.appendChild(tip);

    container.appendChild(bar);
  });

  const first = labels[0] || '';
  const total = buckets.reduce((s, x) => s + x, 0);
  const avgPerBucket = (total / buckets.length).toFixed(1);
  const unit = bucketSizeMs < 24 * 3600_000
    ? `per ${bucketSizeMs / 3600_000}h`
    : 'per day';

  legend.innerHTML = `
    <div>
      <span class="legend-start">${first}</span>
    </div>
    <div>
      <span class="legend-total">Total: ${total}</span>
    </div>
    <div>
      <span class="legend-average">Avg: ${avgPerBucket} ${unit}</span>
    </div>
  `;

  document.getElementById('network-graph-section').style.display = 'block';
}


function updateUI() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const currentTabId = currentTab.id;
    
    // Display current site
    try {
      const url = new URL(currentTab.url);
      document.getElementById('current-site').textContent = url.hostname;
    } catch (e) {
      document.getElementById('current-site').textContent = 'Unknown';
    }

    chrome.storage.local.get([
      'networkRequests', 
      'cookies', 
      'geolocationAttempts', 
      'fingerprintingAttempts', 
      'formData'
    ], (result) => {
      const filterByTab = (arr) => (arr || []).filter(item => item.tabId === currentTabId);

      const requests = filterByTab(result.networkRequests);
      const cookies = filterByTab(result.cookies);
      const geoAttempts = filterByTab(result.geolocationAttempts);
      const fingerprinting = filterByTab(result.fingerprintingAttempts);
      const formData = filterByTab(result.formData);

      // Count third-party requests
      const thirdPartyRequests = requests.filter(r => r.isThirdParty);
      const thirdPartyCookies = cookies.filter(c => c.isThirdParty);

      // Update counts
      updateCount('network-count', requests.length, { warning: 100, alert: 200 });
      updateCount('cookie-count', cookies.length, { warning: 10, alert: 30 });
      updateCount('third-party-count', thirdPartyCookies.length, { warning: 3, alert: 10 });
      updateCount('geo-count', geoAttempts.length, { warning: 1, alert: 1 });
      updateCount('form-count', formData.length, { warning: 5, alert: 10 });
      updateCount('fingerprint-count', fingerprinting.length, { warning: 1, alert: 3 });

      // Find known trackers
      const detectedTrackers = new Map();
      thirdPartyRequests.forEach(req => {
        try {
          const hostname = new URL(req.url).hostname;
          const tracker = getTrackerInfo(hostname);
          if (tracker && !detectedTrackers.has(tracker.name)) {
            detectedTrackers.set(tracker.name, tracker);
          }
        } catch (e) { }
      });

      // Update tracker preview
      updateTrackerPreview(detectedTrackers);

      // Update tips
      updateTips({
        requests,
        thirdPartyRequests,
        cookies,
        thirdPartyCookies,
        geoAttempts,
        fingerprinting,
        formData,
        detectedTrackers,
        currentUrl: currentTab.url
      });
      
      try {
        const { buckets, labels, bucketSizeMs } = computeBuckets(requests);
        renderNetworkGraph(buckets, labels, bucketSizeMs);
      } catch (e) {
        console.error('Error rendering network graph', e);
        document.getElementById('network-graph-section').style.display = 'none';
      }
    });
  });
}

function updateCount(elementId, count, thresholds) {
  const el = document.getElementById(elementId);
  el.textContent = count;
  
  el.classList.remove('alert', 'warning', 'safe');
  
  if (count >= thresholds.alert) {
    el.classList.add('alert');
  } else if (count >= thresholds.warning) {
    el.classList.add('warning');
  } else if (count === 0) {
    el.classList.add('safe');
  }
}

function updateTrackerPreview(trackers) {
  const section = document.getElementById('trackers-section');
  const container = document.getElementById('tracker-preview');
  
  if (trackers.size === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = '';

  const trackersArray = Array.from(trackers.values()).slice(0, 4);
  
  trackersArray.forEach(tracker => {
    const item = document.createElement('div');
    item.className = 'tracker-item';
    item.innerHTML = `
      <span class="tracker-name">${tracker.name}</span>
      <span class="tracker-category ${tracker.category}">${tracker.category}</span>
    `;
    container.appendChild(item);
  });

  if (trackers.size > 4) {
    const seeAll = document.createElement('div');
    seeAll.className = 'see-all';
    seeAll.textContent = `See all ${trackers.size} trackers →`;
    seeAll.addEventListener('click', () => {
      chrome.tabs.create({ url: 'report.html' });
    });
    container.appendChild(seeAll);
  }
}

function updateTips(data) {
  const section = document.getElementById('tips-section');
  const container = document.getElementById('tips-container');
  container.innerHTML = '';
  
  const tips = [];

  // Fingerprinting detection
  if (data.fingerprinting.length > 0) {
    const methods = [...new Set(data.fingerprinting.map(f => f.method))];
    tips.push({
      icon: '⚠️',
      level: 'danger',
      text: `Fingerprinting detected (${methods.join(', ')}). This site may be creating a unique identifier for your device without cookies.`
    });
  }

  // Insecure connection
  if (data.currentUrl && data.currentUrl.startsWith('http:')) {
    tips.push({
      icon: '🔓',
      level: 'danger',
      text: 'Insecure connection (HTTP). Your data is not encrypted and could be intercepted.'
    });
  }

  // Location tracking
  if (data.geoAttempts.length > 0) {
    tips.push({
      icon: '📍',
      level: 'warning',
      text: 'This site requested your location. It now knows your approximate physical address.'
    });
  }

  // Third-party cookies
  if (data.thirdPartyCookies.length > 5) {
    tips.push({
      icon: '🍪',
      level: 'warning',
      text: `${data.thirdPartyCookies.length} third-party cookies detected. These can track you across different websites.`
    });
  }

  // Known trackers summary
  if (data.detectedTrackers.size > 0) {
    const categories = new Map();
    data.detectedTrackers.forEach(t => {
      const count = categories.get(t.category) || 0;
      categories.set(t.category, count + 1);
    });
    
    const summary = Array.from(categories.entries())
      .map(([cat, count]) => `${count} ${cat}`)
      .join(', ');
    
    tips.push({
      icon: '👁️',
      level: 'info',
      text: `Detected trackers: ${summary}. These companies may share data about your browsing habits.`
    });
  }

  // High network activity
  if (data.thirdPartyRequests.length > 50) {
    tips.push({
      icon: '📊',
      level: 'info',
      text: `${data.thirdPartyRequests.length} third-party requests. High background activity often indicates extensive analytics or ad networks.`
    });
  }

  // Form monitoring
  if (data.formData.length > 0) {
    const submissions = data.formData.filter(f => f.action === 'submit').length;
    const inputs = data.formData.filter(f => f.action === 'input').length;
    
    if (inputs > 0) {
      tips.push({
        icon: '✏️',
        level: 'info',
        text: 'Form input monitoring detected. The site may be tracking what you type, even before submitting.'
      });
    }
  }

  // Display tips
  if (tips.length === 0) {
    section.style.display = 'block';
    container.innerHTML = `
      <div class="tip-item">
        <span class="tip-icon" style="color: var(--success-color);">✓</span>
        <span>No major privacy concerns detected on this page so far.</span>
      </div>
    `;
  } else {
    section.style.display = 'block';
    tips.forEach(tip => {
      const item = document.createElement('div');
      item.className = 'tip-item';
      item.innerHTML = `
        <span class="tip-icon ${tip.level}">${tip.icon}</span>
        <span>${tip.text}</span>
      `;
      container.appendChild(item);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateUI();

  // Auto-refresh every 2 seconds
  setInterval(updateUI, 2000);

  document.getElementById('clear-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTabId = tabs[0].id;
      
      chrome.storage.local.get([
        'networkRequests', 
        'cookies', 
        'geolocationAttempts', 
        'fingerprintingAttempts', 
        'formData'
      ], (result) => {
        const clean = (arr) => (arr || []).filter(item => item.tabId !== currentTabId);
        
        chrome.storage.local.set({
          networkRequests: clean(result.networkRequests),
          cookies: clean(result.cookies),
          geolocationAttempts: clean(result.geolocationAttempts),
          fingerprintingAttempts: clean(result.fingerprintingAttempts),
          formData: clean(result.formData)
        }, () => {
          updateUI();
        });
      });
    });
  });

  document.getElementById('report-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'report.html' });
  });
});
