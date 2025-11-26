// Content Script (Runs in ISOLATED world)

// 1. Geolocation Detection
// The actual hooking happens in 'hook_geolocation.js' which runs in the MAIN world.
// We just listen for the message it sends.

// Listen for messages from the MAIN world script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type && event.data.type === 'PRIVACY_EXT_GEO') {
    chrome.runtime.sendMessage({ type: 'GEOLOCATION_ATTEMPT' });
  }
});


// 2. Form Data Detection
// Reference: uBlock/src/js/contentscript.js (domWatcher)

document.addEventListener('submit', (e) => {
  chrome.runtime.sendMessage({ type: 'FORM_SUBMISSION', action: 'submit' });
}, true); // Capture phase

// Optional: Detect input interaction (typing)
// Debounce this to avoid spamming
let inputTimeout;
document.addEventListener('input', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    clearTimeout(inputTimeout);
    inputTimeout = setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'FORM_SUBMISSION', action: 'input' });
    }, 1000);
  }
}, true);
