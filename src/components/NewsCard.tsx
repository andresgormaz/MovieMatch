import type { NewsListItem } from "@/lib/news";

const DATE_LABEL = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

export function NewsCard({ item }: { item: NewsListItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-white/30"
    >
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="h-20 w-20 flex-shrink-0 rounded-lg object-cover sm:h-24 sm:w-24"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="font-medium text-neutral-300">{item.source}</span>
          <span>·</span>
          <span>{DATE_LABEL.format(new Date(item.publishedAt))}</span>
        </div>
        <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
        {item.summary && <p className="line-clamp-2 text-xs text-muted">{item.summary}</p>}
        {item.matched.length > 0 && (
          <p className="mt-0.5 text-xs font-medium text-accent-hover">Relacionado con: {item.matched.join(", ")}</p>
        )}
      </div>
    </a>
  );
}
