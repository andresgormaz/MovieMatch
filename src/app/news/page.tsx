import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshNewsIfStale, getNewsForUser, type NewsListItem } from "@/lib/news";
import { BackToHomeLink } from "@/components/BackToHomeLink";

const DATE_LABEL = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

export default async function NewsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { originalTitles: true } });

  await refreshNewsIfStale();
  const news = await getNewsForUser(userId, user?.originalTitles ?? false);

  const relevant = news.filter((n) => n.relevant);
  const rest = news.filter((n) => !n.relevant);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink />
      <div>
        <h1 className="text-2xl font-bold">Noticias</h1>
        <p className="mt-1 text-sm text-muted">Lo último del mundo del cine y las series.</p>
      </div>

      {news.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          No pudimos traer noticias por ahora. Vuelve a intentarlo en un rato.
        </p>
      )}

      {relevant.length > 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Para ti</h2>
            <p className="text-sm text-muted">Noticias relacionadas con lo que te gusta.</p>
          </div>
          <div className="flex flex-col gap-3">
            {relevant.map((n) => (
              <NewsCard key={n.id} item={n} />
            ))}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div className="flex flex-col gap-4">
          {relevant.length > 0 && <h2 className="text-lg font-bold text-white">Más noticias</h2>}
          <div className="flex flex-col gap-3">
            {rest.map((n) => (
              <NewsCard key={n.id} item={n} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewsCard({ item }: { item: NewsListItem }) {
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
