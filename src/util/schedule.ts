import type { ScopeEvent, Schedule, ScheduleEvent, ScheduleShift, ScheduleSlot } from '@/types'
import md5 from 'md5'

/**
 * Create a new schedule object based on but distinct from an existing event
 * list (either from a scope or another schedule).
 * 
 * @param events Input event list to mimic for the new schedule.
 * @param shouldCopyAssignments If true, worker assignments in the input event
 * list will be preserved in the new schedule.
 * @returns New schedule based on the input events.
 */
export function newSchedule(events: ScopeEvent[]|ScheduleEvent[], shouldCopyAssignments?: boolean) {
    const schedule: Schedule = {
        id: 0,
        name: '',
        events: [],
        steps: []
    }

    for (const event of events) {
        const newEvent: ScheduleEvent = {
            id: event.id,
            name: event.name,
            tags: event.tags.slice(),
            shifts: [],
            calendarDate: event.calendarDate
        }

        for (const shift of event.shifts) {
            const newShift: ScheduleShift = {
                id: shift.id,
                name: shift.name,
                tags: shift.tags.slice(),
                slots: []
            }

            for (const slot of shift.slots) {
                const newSlot: ScheduleSlot = {
                    id: slot.id,
                    name: slot.name,
                    tags: slot.tags.slice(),
                    groupId: slot.groupId,
                    isRequired: slot.isRequired
                }

                if (shouldCopyAssignments === true) {
                    newSlot.workerId = (slot as ScheduleSlot).workerId
                    newSlot.affinity = (slot as ScheduleSlot).affinity
                    newSlot.affinityNotes = (slot as ScheduleSlot).affinityNotes
                }

                newShift.slots.push(newSlot)
            }

            newEvent.shifts.push(newShift)
        }

        schedule.events.push(newEvent)
    }

    return schedule
}

/**
 * Calculates an MD5 hash representing the key values of a Schedule object. This
 * can be used to compare one schedule to another to avoid duplicate generation.
 * 
 * @param schedule The schedule to calculate a hash value for.
 * @returns MD5 hash of the specified schedule.
 */
export function getScheduleHash(schedule: Schedule) {
    const assignments = [] as number[]
    for (const event of schedule.events) {
        for (const shift of event.shifts) {
            for (const slot of shift.slots) {
                let workerId = slot.workerId
                if (workerId === undefined) {
                    workerId = -1
                }
                assignments.push(workerId)
            }
        }
    }
    return md5(JSON.stringify(assignments))
}

/**
 * Can be reversed with deserializeSchedule().
 * 
 * @param schedule The schedule to convert.
 * @returns String version of the schedule.
 */
export function serializeSchedule(schedule: Schedule) {
    return JSON.stringify(schedule)
}

/**
 * Can be reversed with serializeSchedule().
 * 
 * @param json Serialized schedule to convert.
 * @returns Schedule representation of the input string.
 */
export function deserializeSchedule(json: string) {
    return JSON.parse(json) as Schedule
}
