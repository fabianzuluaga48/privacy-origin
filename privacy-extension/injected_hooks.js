// Injected Hooks (Runs in MAIN world)
(function () {
    // Guard against re-injection
    if (window.__privacy_ext_hooked) return;
    window.__privacy_ext_hooked = true;

    // --- Geolocation Hook ---
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

    // --- Canvas Fingerprinting Hook ---
    // Detects attempts to read canvas data, often used for fingerprinting
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

    HTMLCanvasElement.prototype.toDataURL = function () {
        // Only flag if the canvas is actually being read (simplified heuristic)
        window.postMessage({ type: 'PRIVACY_EXT_FINGERPRINT', method: 'HTMLCanvasElement.toDataURL' }, '*');
        return originalToDataURL.apply(this, arguments);
    };

    CanvasRenderingContext2D.prototype.getImageData = function () {
        // High frequency calls might be legitimate (games), but we'll log it for now
        // Debouncing could be added if it's too noisy
        window.postMessage({ type: 'PRIVACY_EXT_FINGERPRINT', method: 'CanvasRenderingContext2D.getImageData' }, '*');
        return originalGetImageData.apply(this, arguments);
    };

    console.log("Privacy Extension: Hooks injected (Geo + Canvas).");
})();
