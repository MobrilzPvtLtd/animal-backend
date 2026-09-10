"use client";

import { useEffect } from "react";

export default function HydrationLoaderRemover() {
  useEffect(() => {
    const loader = document.getElementById("site-loader");
    if (loader) {
      loader.classList.add("shrink-out");
    }

    // Prevent external browser extension errors (e.g. ad blockers, VPNs) from triggering Next.js dev overlay
    const handleExtensionError = (event: ErrorEvent) => {
      if (
        event.filename?.includes("chrome-extension://") ||
        event.filename?.includes("moz-extension://") ||
        event.error?.stack?.includes("chrome-extension://") ||
        event.error?.stack?.includes("moz-extension://")
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };

    const handleExtensionRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.stack?.includes("chrome-extension://") ||
        event.reason?.stack?.includes("moz-extension://")
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleExtensionError, true);
    window.addEventListener("unhandledrejection", handleExtensionRejection, true);

    return () => {
      window.removeEventListener("error", handleExtensionError, true);
      window.removeEventListener("unhandledrejection", handleExtensionRejection, true);
    };
  }, []);

  return null;
}
