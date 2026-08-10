"use client";

import { useState } from "react";

export interface OnboardingPerson {
  id: string;
  name: string;
  photoUrl: string | null;
  department: string | null;
}

export function PersonCard({
  person,
  onRated,
}: {
  person: OnboardingPerson;
  onRated: (personId: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function rate(score: -1 | 0 | 1) {
    if (submitting) return;
    setSubmitting(true);
    await fetch("/api/people/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: person.id, score }),
    });
    onRated(person.id);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 p-4">
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-black/40">
          {person.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photoUrl} alt={person.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">🎭</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight text-white">{person.name}</p>
          {person.department && <p className="text-xs text-muted">{person.department}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <button
          disabled={submitting}
          onClick={() => rate(-1)}
          className="py-2.5 text-xl hover:bg-accent/15 transition-colors disabled:opacity-50"
          aria-label="No me gusta"
        >
          👎
        </button>
        <button
          disabled={submitting}
          onClick={() => rate(0)}
          className="py-2.5 text-xl hover:bg-surface-hover transition-colors disabled:opacity-50"
          aria-label="Neutral"
        >
          😐
        </button>
        <button
          disabled={submitting}
          onClick={() => rate(1)}
          className="py-2.5 text-xl hover:bg-green-500/15 transition-colors disabled:opacity-50"
          aria-label="Me gusta"
        >
          👍
        </button>
      </div>
    </div>
  );
}
