export type CaregiverRole = "MAMA" | "PAPA";

// Shared between onboarding (create) and join/[code] (accept an invite) --
// every caregiver needs a role picked at the moment they're linked to a
// child, so both flows show the same two pills.
export function RolePicker({ value, onChange }: { value: CaregiverRole | null; onChange: (role: CaregiverRole) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-white">¿Quién eres?</span>
      <div className="flex gap-2">
        <RolePill label="Soy mamá" active={value === "MAMA"} onClick={() => onChange("MAMA")} />
        <RolePill label="Soy papá" active={value === "PAPA"} onClick={() => onChange("PAPA")} />
      </div>
    </div>
  );
}

function RolePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
        active ? "border-accent bg-accent/15 text-white" : "border-white/15 text-neutral-300 hover:border-white/30"
      }`}
    >
      {label}
    </button>
  );
}
