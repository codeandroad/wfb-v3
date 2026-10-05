import type { CalEvent } from './data'

export function fullHolidayWeek(events: CalEvent[], dates: string[]) {
  return dates.length === 7 && dates.every(date => events.some(e => e.kind === 'holiday' && date >= e.date && date <= (e.endDate ?? e.date))) && !events.some(e => e.kind === 'swap' && !!e.targetDate && dates.includes(e.targetDate))
}
