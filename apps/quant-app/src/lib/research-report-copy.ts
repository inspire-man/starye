export type ResearchReportCopyResult = 'copied' | 'unavailable' | 'failed'

export interface ResearchReportClipboard {
  writeText: (value: string) => Promise<void>
}

export async function copyResearchReportMarkdown(
  markdown: string,
  clipboard: ResearchReportClipboard | null | undefined,
): Promise<ResearchReportCopyResult> {
  if (!clipboard || typeof clipboard.writeText !== 'function')
    return 'unavailable'

  try {
    await clipboard.writeText(markdown)
    return 'copied'
  }
  catch {
    return 'failed'
  }
}
