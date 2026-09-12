// Picks which name to show for a title based on the user's preference.
// `originalName` is only used when it's actually different and set --
// some titles (older/obscure imports) never got one filled in.
export function displayTitleName(
  title: { name: string; originalName: string | null },
  useOriginal: boolean,
): string {
  if (useOriginal && title.originalName) return title.originalName;
  return title.name;
}
