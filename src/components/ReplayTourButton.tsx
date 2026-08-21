"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Lets a user replay the home coach-mark tutorial on their own account,
// instead of needing a fresh registration just to see it again.
export function ReplayTourButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function replay() {
    setLoading(true);
    try {
      await fetch("/api/tour/complete", { method: "DELETE" });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={replay}
      disabled={loading}
      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm font-medium text-neutral-200 transition-colors hover:border-white/30 hover:bg-surface-hover hover:text-white disabled:opacity-50"
    >
      Ver el tutorial de inicio otra vez
      <span aria-hidden className="text-muted">
        →
      </span>
    </button>
  );
}
