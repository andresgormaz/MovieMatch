export interface ProviderBadge {
  id: number;
  name: string;
  logoUrl: string | null;
}

export function ProviderBadges({ providers }: { providers: ProviderBadge[] }) {
  if (providers.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {providers.map((p) => (
        <span
          key={p.id}
          title={p.name}
          className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-300"
        >
          {p.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- small external provider logos, not worth next/image config
            <img src={p.logoUrl} alt="" className="h-3.5 w-3.5 rounded-sm" />
          )}
          {p.name}
        </span>
      ))}
    </div>
  );
}
