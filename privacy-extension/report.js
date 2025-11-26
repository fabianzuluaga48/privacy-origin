// Report Logic

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['globalStats'], (result) => {
        const stats = result.globalStats || { trackers: {}, websitesVisited: [] };
        const trackers = stats.trackers;

        // 1. Total Trackers Detected
        const totalTrackers = Object.keys(trackers).length;
        document.getElementById('total-trackers').textContent = totalTrackers;

        // 2. Websites Contacting Trackers
        // This is an approximation. We count how many unique sites in 'websitesVisited' have at least one tracker associated.
        // Actually, a simpler metric for now: % of visited sites that had trackers.
        const totalSites = stats.websitesVisited.length;
        let sitesWithTrackers = new Set();
        Object.values(trackers).forEach(t => {
            t.sites.forEach(site => sitesWithTrackers.add(site));
        });

        const percentage = totalSites > 0 ? Math.round((sitesWithTrackers.size / totalSites) * 100) : 0;
        document.getElementById('websites-tracked').textContent = `${percentage}%`;

        // 3. Most Contacted Tracker
        let topTracker = 'None';
        let maxSites = 0;

        // Convert to array for sorting
        const trackerArray = Object.keys(trackers).map(domain => {
            return {
                domain: domain,
                count: trackers[domain].count,
                sites: trackers[domain].sites.length
            };
        });

        trackerArray.sort((a, b) => b.sites - a.sites);

        if (trackerArray.length > 0) {
            topTracker = trackerArray[0].domain;
            maxSites = trackerArray[0].sites;
        }

        document.getElementById('top-tracker').textContent = topTracker;
        document.getElementById('top-tracker-desc').textContent = `was seen across ${maxSites} websites.`;

        // 4. Populate List
        const listContainer = document.getElementById('tracker-rows');
        // Show top 20
        trackerArray.slice(0, 20).forEach(t => {
            const row = document.createElement('div');
            row.className = 'list-item';
            row.innerHTML = `
        <span class="tracker-name">${t.domain}</span>
        <span class="tracker-count">${t.sites}</span>
      `;
            listContainer.appendChild(row);
        });
    });
});
