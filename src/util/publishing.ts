import type { Schedule, Tag, Worker } from '@/types'
import type { DisplaySchedule, DisplayScheduleSlotGroup, DisplayScheduleShift, DisplayScheduleEvent } from '@/types'
import type { MinifiedDisplaySchedule, MinifiedDisplayScheduleSlotGroup, MinifiedDisplayScheduleShift, MinifiedDisplayScheduleEvent } from '@/types'

/**
 * Turns minified "#|#"-style affinity notes into expaned notes with tag names.
 * Other notes are left as is. The original input list is not modified.
 * 
 * @param notes List of assignment affinity notes as populated by
 * utilGeneration.getEligibleWorkersForSlot().
 * @param tags List of tags to use for ID lookups (e.g., setup.tags).
 * @returns New list of notes with any relevant modifications.
 */
export function getConvertedAffinityNotes(notes: string[], tags: Tag[]) {
    const workingCopy = notes.slice()

    for (const i in workingCopy) {
        const currentNote = workingCopy[i] as string

        // Test if this is a tag affinity note
        const parts = currentNote.split('|')
        if (parts.length !== 2) {
            continue
        }
        const id1 = parseInt(parts[0] as string)
        const id2 = parseInt(parts[1] as string)
        if (isNaN(id1) || isNaN(id2)) {
            continue
        }

        // Look up the tag names and build a new note
        const tag1 = tags.find((t) => t.id === id1)
        const tag2 = tags.find((t) => t.id === id2)
        workingCopy[i] = `"${tag1?.name}" / "${tag2?.name}"`
    }

    return workingCopy
}

/**
 * Creates a new display schedule object with functional details removed and
 * worker names expanded from the specified schedule.
 * 
 * @param schedule Regular schedule to convert.
 * @param workers List of workers for ID lookups (e.g., setup.workers).
 * @returns New display schedule.
 */
export function getDisplayScheduleFromSchedule(schedule: Schedule, workers: Worker[]) {
    const ds: DisplaySchedule = {
        events: []
    }

    for (const event of schedule.events) {
        const newEvent: DisplayScheduleEvent = {
            name: event.name,
            calendarDate: event.calendarDate,
            shifts: [],
        }

        for (const shift of event.shifts) {
            const newShift: DisplayScheduleShift = {
                name: shift.name,
                slotGroups: [],
            }

            const uniqueGroupIds = [...new Set(shift.slots.map((l) => l.groupId))].sort()
            for (const groupId of uniqueGroupIds) {
                const newGroup: DisplayScheduleSlotGroup = {
                    slots: []
                }

                const slots = shift.slots.filter((l) => l.groupId === groupId)
                for (const slot of slots) {
                    newGroup.slots.push({
                        name: slot.name,
                        workerName: workers.find((w) => w.id === slot.workerId)?.name || 'N/A',
                    })
                }

                newShift.slotGroups.push(newGroup)
            }

            newEvent.shifts.push(newShift)
        }

        ds.events.push(newEvent)
    }

    return ds
}

/**
 * Creates a new minified display schedule, using shorter property names to
 * convey the same information in order to reduce transfer overhead. Can be
 * reversed with getDisplayScheduleFromMinifiedDisplaySchedule().
 * 
 * @param schedule Display schedule to convert.
 * @returns New minified display schedule.
 */
export function getMinifiedDisplayScheduleFromDisplaySchedule(schedule: DisplaySchedule) {
    const minified: MinifiedDisplaySchedule = {
        e: [],
        s: []
    }

    const getOrAddStringIndex = function(value: string) {
        const i = minified.s.findIndex((v) => v === value)
        if (i !== -1) {
            return i
        } else {
            return minified.s.push(value) - 1
        }
    }

    for (const event of schedule.events) {
        const newEvent: MinifiedDisplayScheduleEvent = {
            n: getOrAddStringIndex(event.name),
            d: getOrAddStringIndex(event.calendarDate),
            s: [],
        }

        for (const shift of event.shifts) {
            const newShift: MinifiedDisplayScheduleShift = {
                n: getOrAddStringIndex(shift.name),
                g: [],
            }

            for (const group of shift.slotGroups) {
                const newGroup: MinifiedDisplayScheduleSlotGroup = {
                    s: [],
                }

                for (const slot of group.slots) {
                    newGroup.s.push({
                        n: getOrAddStringIndex(slot.name),
                        w: getOrAddStringIndex(slot.workerName),
                    })
                }

                newShift.g.push(newGroup)
            }

            newEvent.s.push(newShift)
        }

        minified.e.push(newEvent)
    }

    return minified
}

/**
 * Creates a new display schedule, using longer property names to improve user
 * experience over the minified input. Can be reversed with
 * getMinifiedDisplayScheduleFromDisplaySchedule().
 * 
 * @param minified Minified display schedule to convert.
 * @returns New display schedule.
 */
export function getDisplayScheduleFromMinifiedDisplaySchedule(minified: MinifiedDisplaySchedule) {
    const schedule: DisplaySchedule = {
        events: []
    }

    for (const event of minified.e) {
        const newEvent: DisplayScheduleEvent = {
            name: minified.s[event.n] || '',
            calendarDate: minified.s[event.d] || '',
            shifts: [],
        }

        for (const shift of event.s) {
            const newShift: DisplayScheduleShift = {
                name: minified.s[shift.n] || '',
                slotGroups: []
            }

            for (const group of shift.g) {
                const newGroup: DisplayScheduleSlotGroup = {
                    slots: [],
                }

                for (const slot of group.s) {
                    newGroup.slots.push({
                        name: minified.s[slot.n] || '',
                        workerName: minified.s[slot.w] || '',
                    })
                }

                newShift.slotGroups.push(newGroup)
            }

            newEvent.shifts.push(newShift)
        }

        schedule.events.push(newEvent)
    }

    return schedule
}
