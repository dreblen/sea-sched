// Given a string in the format of YYYY-MM-DD, return a JS Date object for
// that date at midnight local time, to avoid skewing issues
export function getNormalizedDate(dateString: string) {
    const buffer = new Date(dateString + 'T00:00:00Z')
    buffer.setMinutes(buffer.getMinutes() + buffer.getTimezoneOffset())
    return buffer
}

// Given a JS Date object, return a string representing it as YYYY-MM-DD
export function getDateString(date?: Date) {
    if (date === undefined) {
        date = new Date()
    }
    return date.toISOString().split('T')[0] as string
}

////////////////////////////////////////////////////////////////////////////////
// Helpers for managing events in stores
////////////////////////////////////////////////////////////////////////////////

import type { GenericEvent, GenericShift, GenericSlot } from '@/types'

export interface EventManagementStore {
    addEvent: { (): GenericEvent|void }
    removeEvent: { (eventId?: number): void }
    addEventShift: { (eventId: number): GenericShift|void }
    removeEventShift: { (eventId?: number, shiftId?: number): void }
    addShiftSlot: { (eventId: number, shiftId: number): GenericSlot|void }
    removeShiftSlot: { (eventId?: number, shiftId?: number, slotId?: number): void }
}

export function addEvent(events: GenericEvent[]) {
    const maxEventId = events.reduce((p, c) => (p > c.id) ? p : c.id, 0)
    const newEvent: GenericEvent = {
        id: maxEventId + 1,
        name: `New Event ${maxEventId + 1}`,
        tags: [],
        shifts: [],
    }
    
    events.push(newEvent)
    return newEvent
}

export function removeEvent(events: GenericEvent[], id?: number) {
    if (id === undefined) {
        return
    }
    return events.filter((e) => e.id !== id)
}

export function addEventShift(events: GenericEvent[], eventId: number) {
    const event = events.find((e) => e.id === eventId)
    if (!event) {
        return
    }

    const maxShiftId = event.shifts.reduce((p, c) => (p > c.id) ? p : c.id, 0)
    const newShift: GenericShift = {
        id: maxShiftId + 1,
        name: `New Shift ${maxShiftId + 1}`,
        tags: [],
        slots: []
    }

    event.shifts.push(newShift)
    return newShift
}

export function removeEventShift(events: GenericEvent[], eventId?: number, shiftId?: number) {
    if (eventId === undefined || shiftId === undefined) {
        return
    }

    const event = events.find((e) => e.id === eventId)
    if (!event) {
        return
    }

    event.shifts = event.shifts.filter((s) => s.id !== shiftId)
}

export function addShiftSlot(events: GenericEvent[], eventId: number, shiftId: number) {
    const event = events.find((e) => e.id === eventId)
    if (!event) {
        return
    }

    const shift = event.shifts.find((s) => s.id === shiftId)
    if (!shift) {
        return
    }

    const maxSlotId = shift.slots.reduce((p, c) => (p > c.id) ? p : c.id, 0)
    const newSlot: GenericSlot = {
        id: maxSlotId + 1,
        name: `New Slot ${maxSlotId + 1}`,
        tags: [],
        isRequired: true
    }

    shift.slots.push(newSlot)
    return newSlot
}

export function removeShiftSlot(events: GenericEvent[], eventId?: number, shiftId?: number, slotId?: number) {
    if (eventId === undefined || shiftId === undefined || slotId === undefined) {
        return
    }

    const event = events.find((e) => e.id === eventId)
    if (!event) {
        return
    }

    const shift = event.shifts.find((s) => s.id === shiftId)
    if (!shift) {
        return
    }

    shift.slots = shift.slots.filter((s) => s.id !== slotId)
}

////////////////////////////////////////////////////////////////////////////////
// Helpers for schedule generation
////////////////////////////////////////////////////////////////////////////////

import type { ScopeEvent, Schedule, ScheduleEvent, ScheduleShift, ScheduleSlot, TagAffinityMapMap, Worker } from '@/types'

// Create a new schedule object based on but distinct from an existing event
// list (either from a scope or another schedule)
export function newSchedule(events: ScopeEvent[]|ScheduleEvent[]) {
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
                newShift.slots.push({
                    id: slot.id,
                    name: slot.name,
                    tags: slot.tags.slice(),
                    isRequired: slot.isRequired
                })
            }

            newEvent.shifts.push(newShift)
        }

        schedule.events.push(newEvent)
    }

    return schedule
}

export interface GenerationSlot {
    event: ScheduleEvent
    shift: ScheduleShift
    slot: ScheduleSlot
}

// Create a new set of generation slots based on an events list
export function newGenerationSlots(events: ScopeEvent[]|ScheduleEvent[]) {
    const generationSlots = [] as GenerationSlot[]
    for (const event of events) {
        for (const shift of event.shifts) {
            for (const slot of shift.slots) {
                generationSlots.push({
                    event,
                    shift,
                    slot
                })
            }
        }
    }

    return generationSlots
}

// Determine a prioritized list of workers who are able to fill a specified slot
export function getEligibleWorkersForSlot(gs: GenerationSlot, workers: Worker[], affinitiesByTagTag: TagAffinityMapMap) {
    const tags = [...new Set(gs.event.tags.concat(gs.shift.tags, gs.slot.tags))]

    const workersRequired = [] as number[]
    const workersPreferred = [] as number[]
    const workersNeutral = [] as number[]
    const workersUnwanted = [] as number[]

    for (const worker of workers) {
        // If this worker is already assigned to a slot in the same shift, they
        // are not eligible for this slot
        if (gs.shift.slots.find((s) => s.workerId === worker.id)) {
            continue
        }

        // If this slot or worker has no tags, they are eligible
        if (tags.length === 0 || worker.tags.length === 0) {
            workersNeutral.push(worker.id)
            continue
        }

        // If this worker has no tag affinities, they are eligible
        const affinityMaps = worker.tags.map((t) => affinitiesByTagTag[t])
        if (affinityMaps.length === 0) {
            workersNeutral.push(worker.id)
            continue
        }

        // Check for tag affinities between this worker and the slot
        for (const affinityMap of affinityMaps) {
            if (affinityMap === undefined) {
                continue
            }

            for (const tag of tags) {
                const affinity = affinityMap[tag]
                
                // Required affinities take first priority
                if (affinity?.isRequired) {
                    // If there is a positive, required affinity, add the worker
                    // to the required workers list
                    if (affinity.isPositive) {
                        workersRequired.push(worker.id)
                        continue
                    }
                    // If there is a negative, required affinity, exclude the
                    // worker from consideration for this slot
                    else {
                        continue
                    }
                }
                // Optional affinities are preferences
                else {
                    // Positive means we should try to make this assignment
                    if (affinity?.isPositive) {
                        workersPreferred.push(worker.id)
                        continue
                    }
                    // Negative means we should try to avoid this assignment
                    else if (affinity?.isPositive === false) {
                        workersUnwanted.push(worker.id)
                        continue
                    }
                }

                // Add any other workers to the eligible list for this slot
                workersNeutral.push(worker.id)
            }
        }
    }

    if (workersRequired.length > 0) {
        return workersRequired
    } else if (workersPreferred.length > 0) {
        return workersPreferred
    } else if (workersNeutral.length > 0) {
        return workersNeutral
    } else {
        return workersUnwanted
    }
}
