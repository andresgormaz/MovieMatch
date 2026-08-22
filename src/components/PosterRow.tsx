import Link from "next/link";
import { Poster } from "@/components/Poster";

export interface PosterRowItem {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  posterUrl: string | null;
  subtitle?: string | null;
}

// Shared horizontal-scroll poster row -- used anywhere a page needs to show
// "here are some titles" without the full rate/wishlist card treatment
// (that lives on /title/[id], one tap away).
export function PosterRow({ title, items }: { title?: string; items: PosterRowItem[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      {title && <h2 className="mb-2 text-sm font-semibold text-white">{title}</h2>}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <Link key={item.id} href={`/title/${item.id}`} className="flex w-24 flex-shrink-0 flex-col gap-1.5 sm:w-28">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-lg shadow-lg shadow-black/40">
              <Poster name={item.name} type={item.type} posterUrl={item.posterUrl} />
            </div>
            <p className="truncate text-xs font-medium text-white" title={item.name}>
              {item.name}
            </p>
            {item.subtitle && <p className="text-[11px] text-muted">{item.subtitle}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
