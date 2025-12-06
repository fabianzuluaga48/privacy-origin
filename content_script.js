(function () {
  "use strict";


  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    // Verify it's from our extension
    if (event.data.source !== "privacy-origin-extension") return;

    // Forward to background script
    if (event.data.type === "PRIVACY_EXT_GEO") {
      safelySendMessage({
        type: "GEOLOCATION_ATTEMPT",
        method: event.data.method,
      });
    } else if (event.data.type === "PRIVACY_EXT_FINGERPRINT") {
      safelySendMessage({
        type: "FINGERPRINTING_ATTEMPT",
        method: event.data.method,
        detail: event.data.detail,
      });
    }
  });

//functions for helper
  function safelySendMessage(message) {
    try {
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage(message);
      }
    } catch (e) {
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  //sensitive field types to track more carefully
  const SENSITIVE_FIELDS = [
    "password",
    "email",
    "tel",
    "ssn",
    "credit-card",
    "cc-number",
    "cc-exp",
    "cc-csc",
    "address",
    "postal-code",
  ];

  function getFieldType(input) {
    const type = input.type?.toLowerCase() || "text";
    const name = input.name?.toLowerCase() || "";
    const autocomplete = input.autocomplete?.toLowerCase() || "";

    //checks for sensitive autocomplete values
    for (const sensitive of SENSITIVE_FIELDS) {
      if (
        autocomplete.includes(sensitive) ||
        name.includes(sensitive.replace("-", ""))
      ) {
        return sensitive;
      }
    }

    return type;
  }

  document.addEventListener(
    "submit",
    (e) => {
      const form = e.target;
      const inputCount = form.querySelectorAll(
        "input, textarea, select"
      ).length;

      safelySendMessage({
        type: "FORM_SUBMISSION",
        action: "submit",
        fieldCount: inputCount,
      });
    },
    true
  );

  const formInputTrackers = new WeakMap();

  document.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const form = target.closest("form") || document;

      if (!formInputTrackers.has(form)) {
        formInputTrackers.set(
          form,
          debounce(() => {
            const fieldType = getFieldType(target);
            safelySendMessage({
              type: "FORM_SUBMISSION",
              action: "input",
              fieldType: fieldType,
            });
          }, 2000)
        );
      }

      formInputTrackers.get(form)();
    },
    true
  );


  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          //check for 1x1 tracking iframes
          if (node.tagName === "IFRAME") {
            const rect = node.getBoundingClientRect();
            if (rect.width <= 1 && rect.height <= 1) {
              //this is likely a tracking pixel
              //we already capture this via network requests, so just noting here
            }
          }
        }
      });
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
