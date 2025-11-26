// Popup Logic

function updateUI() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTabId = tabs[0].id;

        chrome.storage.local.get(['networkRequests', 'cookies', 'geolocationAttempts', 'formData'], (result) => {
            const filterByTab = (arr) => (arr || []).filter(item => item.tabId === currentTabId);

            const requests = filterByTab(result.networkRequests);
            const cookies = filterByTab(result.cookies);
            const geoAttempts = filterByTab(result.geolocationAttempts);
            const formData = filterByTab(result.formData);

            document.getElementById('network-count').textContent = requests.length;
            document.getElementById('cookie-count').textContent = cookies.length;

            const geoCount = geoAttempts.length;
            const geoEl = document.getElementById('geo-count');
            geoEl.textContent = geoCount;
            if (geoCount > 0) geoEl.classList.add('alert');
            else geoEl.classList.remove('alert');

            document.getElementById('form-count').textContent = formData.length;

            updateTips({
                networkRequests: requests,
                cookies: cookies,
                geolocationAttempts: geoAttempts,
                formData: formData
            });
        });
    });
}

function updateTips(data) {
    const tipsContainer = document.getElementById('tips-container');
    const tipsList = document.getElementById('tips-list');
    tipsList.innerHTML = '';
    let tips = [];

    const cookies = data.cookies || [];
    const thirdPartyCookies = cookies.filter(c => c.isThirdParty).length;

    if (thirdPartyCookies > 0) {
        tips.push("Third-party cookies allow advertisers to track you across different websites. Consider disabling third-party cookies in your browser settings.");
    }

    if ((data.geolocationAttempts || []).length > 0) {
        tips.push("This site has accessed your precise location. If this wasn't necessary, revoke the location permission in your browser's site settings.");
    }

    if ((data.formData || []).length > 0) {
        tips.push("Be careful what you type! Form interactions are being monitored. Never enter sensitive info on untrusted sites.");
    }

    if ((data.networkRequests || []).length > 50) {
        tips.push("High background activity detected. This can indicate analytics or tracking scripts running in the background.");
    }

    if (tips.length > 0) {
        tipsContainer.style.display = 'block';
        tips.forEach(tip => {
            const li = document.createElement('li');
            li.textContent = tip;
            tipsList.appendChild(li);
        });
    } else {
        tipsContainer.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateUI();

    // Auto-refresh every second
    setInterval(updateUI, 1000);

    document.getElementById('clear-btn').addEventListener('click', () => {
        chrome.storage.local.clear(() => {
            updateUI();
        });
    });

    document.getElementById('report-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'report.html' });
    });
});
