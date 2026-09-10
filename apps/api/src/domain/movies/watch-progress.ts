export const MOVIE_COMPLETED_THRESHOLD = 0.9

export function deriveWatchCompleted(
  position: number,
  duration: number | null | undefined,
  completed = false,
): boolean {
  if (completed)
    return true
  if (!duration || duration <= 0)
    return false
  return position / duration >= MOVIE_COMPLETED_THRESHOLD
}
