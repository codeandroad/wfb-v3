export const SCHOOL_TIME_ZONE = "Asia/Shanghai"

export function schoolNow(at = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(at)
  const value = (key: string) => parts.find(p => p.type === key)!.value
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}+08:00`
}
