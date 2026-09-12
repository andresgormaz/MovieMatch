import { EMPTY_CATALOG_FILTERS, type CatalogFilters } from "@/lib/catalogFilters";

const STORAGE_PREFIX = "moviematch:filters:";

// "Sticky" filters: whatever a user last applied on a given page, kept
// across navigation and reloads until they explicitly hit "Limpiar" --
// per-device (localStorage), one key per page (explore/recommendations/
// wishlist) since each page's filter selection is independent. Only ever
// call these from inside an effect or event handler (never during the
// initial render) -- `window` doesn't exist during SSR, and reading it
// synchronously at render time would produce a server/client mismatch.
export function loadStoredFilters(page: string): CatalogFilters | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + page);
    if (!raw) return null;
    return { ...EMPTY_CATALOG_FILTERS, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

export function storeFilters(page: string, filters: CatalogFilters): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + page, JSON.stringify(filters));
  } catch {
    // localStorage can throw (private browsing, quota) -- losing stickiness
    // isn't worth failing the filter apply over.
  }
}

export function clearStoredFilters(page: string): void {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + page);
  } catch {
    // see storeFilters
  }
}
