export type SecurityAlertSeverity = 'critical' | 'high' | 'medium' | 'low'

export type SecurityAlertInput = {
  eventKey: string
  source: string
  category: string
  severity: SecurityAlertSeverity
  title: string
  message: string
  metadata?: Record<string, unknown>
}

export const raiseSecurityAlert = async (
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ error: { message?: string } | null }>
  },
  input: SecurityAlertInput
) => {
  const { error } = await supabase.rpc('raise_security_alert', {
    p_event_key: input.eventKey,
    p_source: input.source,
    p_category: input.category,
    p_severity: input.severity,
    p_title: input.title,
    p_message: input.message,
    p_metadata: input.metadata ?? {},
  })

  if (error) {
    console.error('raise_security_alert rpc error:', error)
  }
}
