import Link from "next/link";
import type { ReviewListItem } from "@/lib/reviews";
import { tmdbPosterUrl, tmdbReviewAvatarUrl } from "@/lib/tmdb";
import { Poster } from "@/components/Poster";

// Links into our own title page (not out to TMDB) -- that's the more useful
// destination inside the app, and keeping the whole card a single link
// avoids nesting an anchor inside an anchor. Reviews are TMDB's community
// reviews, which are overwhelmingly in English regardless of the title's
// language -- labelled explicitly rather than pretending otherwise.
export function ReviewCard({ review }: { review: ReviewListItem }) {
  const avatarUrl = tmdbReviewAvatarUrl(review.authorAvatarPath);

  return (
    <Link
      href={`/title/${review.title.id}`}
      className="flex gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-white/30"
    >
      <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded-md bg-black/40">
        <Poster name={review.title.name} type={review.title.type} posterUrl={tmdbPosterUrl(review.title.posterPath, "w92")} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-xs font-semibold text-accent-hover">{review.title.name}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-5 w-5 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-neutral-300">
              {review.author.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate font-medium text-neutral-300">{review.author}</span>
          {review.authorRating != null && <span className="flex-shrink-0">★ {review.authorRating}/10</span>}
        </div>
        <p className="line-clamp-3 text-xs text-muted">{review.content}</p>
        <span className="mt-0.5 text-[10px] text-neutral-500">Reseña de la comunidad de TMDB, en inglés</span>
      </div>
    </Link>
  );
}
