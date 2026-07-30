import type { AdapterExecutionContext, AdapterExecutionResult, TaskRunnerAdapter } from './template-adapters'

export function createControlledAdapter(steps: readonly (() => Promise<void>)[]): TaskRunnerAdapter {
  return {
    templateKey: 'movie',
    async execute(context: AdapterExecutionContext): Promise<AdapterExecutionResult> {
      for (const step of steps) {
        if (await context.checkpoint()) {
          return { contentIds: [] }
        }
        await step()
      }
      return { contentIds: [] }
    },
  }
}
