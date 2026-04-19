export type CommercialPlanPeriod = 'daily' | 'weekly' | 'monthly'

const DAILY_PLAN_IDS = new Set(['starter', 'pro', 'expert'])
const WEEKLY_PLAN_IDS = new Set(['starter_weekly', 'pro_weekly', 'expert_weekly'])
const MONTHLY_PLAN_IDS = new Set(['starter_monthly', 'pro_monthly', 'expert_monthly'])

const normalizeDate = (input: Date | string | number) =>
  input instanceof Date ? new Date(input.getTime()) : new Date(input)

const addCalendarMonth = (input: Date) => {
  const result = new Date(input.getTime())
  result.setUTCMonth(result.getUTCMonth() + 1)
  return result
}

export const getCommercialPlanPeriod = (planId: string): CommercialPlanPeriod => {
  if (MONTHLY_PLAN_IDS.has(planId)) return 'monthly'
  if (WEEKLY_PLAN_IDS.has(planId)) return 'weekly'
  if (DAILY_PLAN_IDS.has(planId)) return 'daily'
  return 'daily'
}

export const getPlanExpiryAtByStart = (planId: string, startedAt: Date | string | number) => {
  const startDate = normalizeDate(startedAt)

  if (Number.isNaN(startDate.getTime())) {
    return new Date().toISOString()
  }

  switch (getCommercialPlanPeriod(planId)) {
    case 'monthly':
      return addCalendarMonth(startDate).toISOString()
    case 'weekly':
      return new Date(startDate.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString()
    default:
      return new Date(startDate.getTime() + (24 * 60 * 60 * 1000)).toISOString()
  }
}
