import type { ProjectedEntry } from "./data"

export interface ActivityDisplayGroup {
  key: string
  entries: ProjectedEntry[]
  teacherIds: string[]
  rooms: string[]
  /** Number of arrangements without an assigned place, not a synthetic shared room. */
  unknownRoomCount: number
}

/**
 * Display-only grouping of already filtered entries. Equal names and slots do not
 * establish a shared event: every original arrangement and conflict stays intact.
 */
export function groupActivityEntries(entries: readonly ProjectedEntry[]): ActivityDisplayGroup[] {
  const groups: ActivityDisplayGroup[] = []
  const activities = new Map<string, ActivityDisplayGroup>()
  const occurrences = new Map<string, number>()
  for (const entry of entries) {
    const activity = entry.kind === "activity"
    const identity = JSON.stringify(activity
      ? ["activity", entry.date, entry.periodId, entry.className]
      : ["entry", entry.kind ?? "class", entry.teacherId, entry.date, entry.key])
    let group = activity ? activities.get(identity) : undefined
    if (!group) {
      const occurrence = occurrences.get(identity) ?? 0
      occurrences.set(identity, occurrence + 1)
      group = { key: activity ? identity : JSON.stringify([identity, occurrence]), entries: [], teacherIds: [], rooms: [], unknownRoomCount: 0 }
      groups.push(group)
      if (activity) activities.set(identity, group)
    }
    group.entries.push(entry)
    if (entry.teacherId && !group.teacherIds.includes(entry.teacherId)) group.teacherIds.push(entry.teacherId)
    const room = entry.room?.trim()
    if (!room) group.unknownRoomCount++
    else if (!group.rooms.includes(room)) group.rooms.push(room)
  }
  return groups
}
