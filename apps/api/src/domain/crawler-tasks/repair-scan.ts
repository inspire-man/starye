export interface RepairScanCandidate {
  id: string
  code: string
  title: string
  disposition: 'no_source' | 'source_failed'
  source_revision: number
  consecutive_failures: number
  last_attempt_at: number | null
  next_retry_at: number | null
}

interface ScanDatabase {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => {
      all: <T>() => Promise<{ results?: T[] }>
    }
  }
}

export async function readRepairScanCandidates(db: ScanDatabase, now: number, limit: number): Promise<RepairScanCandidate[]> {
  // Rank terminal attempts per movie, counting only failures after the last non-failure.
  const result = await db.prepare(`
    WITH repair_runs AS (
      SELECT COALESCE(json_extract(t.request_snapshot_json, '$.target.id'),
                      json_extract(t.request_snapshot_json, '$.movieId')) AS movie_id,
             r.status, COALESCE(r.terminal_at, r.created_at) AS attempted_at,
             ROW_NUMBER() OVER (
               PARTITION BY COALESCE(json_extract(t.request_snapshot_json, '$.target.id'),
                                     json_extract(t.request_snapshot_json, '$.movieId'))
               ORDER BY COALESCE(r.terminal_at, r.created_at) DESC, r.id DESC
             ) AS position
      FROM crawler_task t JOIN crawler_run r ON r.task_id = t.id
      WHERE t.operation = 'repair_players'
        AND r.status IN ('succeeded', 'failed', 'cancelled')
    ), history AS (
      SELECT movie_id, MAX(attempted_at) AS last_attempt_at,
             COALESCE(MIN(CASE WHEN status != 'failed' THEN position END) - 1, COUNT(*)) AS consecutive_failures
      FROM repair_runs GROUP BY movie_id
    ), candidates AS (
      SELECT m.id, m.code, m.title,
             CASE WHEN NOT EXISTS (SELECT 1 FROM player p WHERE p.movie_id = m.id)
                  THEN 'no_source' ELSE 'source_failed' END AS disposition,
             COALESCE(s.source_revision, 0) AS source_revision,
             COALESCE(h.consecutive_failures, 0) AS consecutive_failures,
             h.last_attempt_at,
             CASE WHEN h.last_attempt_at IS NOT NULL THEN h.last_attempt_at +
               CASE WHEN h.consecutive_failures >= 4 THEN 86400
                    WHEN h.consecutive_failures = 3 THEN 43200
                    WHEN h.consecutive_failures = 2 THEN 21600
                    ELSE 3600 END
             END AS next_retry_at
      FROM movie m
      LEFT JOIN movie_source_state s ON s.movie_id = m.id
      LEFT JOIN history h ON h.movie_id = m.id
      WHERE (s.disposition IS NULL OR s.disposition != 'repairing')
        AND (NOT EXISTS (SELECT 1 FROM player p WHERE p.movie_id = m.id)
             OR (s.disposition = 'source_failed' AND s.observed_at <= ? - 86400))
        AND NOT EXISTS (
          SELECT 1 FROM crawler_task t JOIN crawler_run r ON r.task_id = t.id
          WHERE t.operation = 'repair_players'
            AND COALESCE(json_extract(t.request_snapshot_json, '$.target.id'),
                         json_extract(t.request_snapshot_json, '$.movieId')) = m.id
            AND r.status IN ('queued', 'dispatching', 'running', 'cancel_requested')
        )
    )
    SELECT * FROM candidates
    WHERE next_retry_at IS NULL OR next_retry_at <= ?
    ORDER BY COALESCE(last_attempt_at, 0), id
    LIMIT ?
  `).bind(now, now, limit).all<RepairScanCandidate>()
  return result.results ?? []
}
