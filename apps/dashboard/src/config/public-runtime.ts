export interface DashboardPublicRuntime {
  readonly targetId: string
  readonly gatewayBaseUrl: string
  readonly apiBaseUrl: string
  readonly appBasePath: string
  readonly sentryDsn?: string
  readonly sentryRelease?: string
  readonly buildMode: string
}

declare const __STARYE_DASHBOARD_PUBLIC_RUNTIME__: DashboardPublicRuntime

export const dashboardPublicRuntime = __STARYE_DASHBOARD_PUBLIC_RUNTIME__
