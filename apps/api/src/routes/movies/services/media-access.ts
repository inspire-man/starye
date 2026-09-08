/** Restrict image fields without changing catalog metadata or stored rows. */
export function protectMovieImages<T extends { isR18: boolean, coverImage: string | null, previewImages?: unknown }>(movie: T, isAdult: boolean): T {
  if (!movie.isR18 || isAdult)
    return movie

  return {
    ...movie,
    coverImage: null,
    ...('previewImages' in movie ? { previewImages: [] } : {}),
  }
}
