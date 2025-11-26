// Injected Script (Runs in page context)

(function () {
    const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
    const originalWatchPosition = navigator.geolocation.watchPosition;

    navigator.geolocation.getCurrentPosition = function (success, error, options) {
        window.postMessage({ type: 'PRIVACY_EXT_GEO', method: 'getCurrentPosition' }, '*');
        return originalGetCurrentPosition.apply(this, arguments);
    };

    navigator.geolocation.watchPosition = function (success, error, options) {
        window.postMessage({ type: 'PRIVACY_EXT_GEO', method: 'watchPosition' }, '*');
        return originalWatchPosition.apply(this, arguments);
    };
})();
