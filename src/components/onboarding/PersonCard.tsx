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
    <div className="flex items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-neutral-800">
        {person.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.photoUrl} alt={person.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">🎭</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{person.name}</p>
        {person.department && <p className="text-xs text-neutral-500">{person.department}</p>}
      </div>
      <div className="flex gap-2">
        <button
          disabled={submitting}
          onClick={() => rate(-1)}
          className="rounded-full border border-neutral-700 px-3 py-2 text-lg hover:border-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
          aria-label="No me gusta"
        >
          👎
        </button>
        <button
          disabled={submitting}
          onClick={() => rate(0)}
          className="rounded-full border border-neutral-700 px-3 py-2 text-lg hover:border-neutral-400 transition-colors disabled:opacity-50"
          aria-label="Neutral"
        >
          😐
        </button>
        <button
          disabled={submitting}
          onClick={() => rate(1)}
          className="rounded-full border border-neutral-700 px-3 py-2 text-lg hover:border-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-50"
          aria-label="Me gusta"
        >
          👍
        </button>
      </div>
    </div>
  );
}
