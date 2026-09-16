"use client";

import { useEffect } from "react";

// Records "the home screen was actually opened" once the client mounts and
// runs this component's JS -- unlike a write inside the server component's
// render, a prefetch of /dashboard never executes client JS, so it can't
// silently advance the homeVisitedAt baseline before a real visit happens.
export function VisitBeacon() {
  useEffect(() => {
    fetch("/api/me/visit", { method: "POST" });
  }, []);

  return null;
}
