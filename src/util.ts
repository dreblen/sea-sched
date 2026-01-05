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

import type { EligibleWorker, ScopeEvent, ScheduleGrade, Schedule, ScheduleEvent, ScheduleShift, ScheduleSlot, TagAffinityMapMap, Worker } from '@/types'
import { AssignmentAffinity } from '@/types'
import md5 from 'md5'

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

// Determine a prioritized list of workers who are able to fill a specified
// slot, along with an indicator of what affinity the workers in that list will
// have with the slot
export function getEligibleWorkersForSlot(gs: GenerationSlot, workers: Worker[], affinitiesByTagTag: TagAffinityMapMap): EligibleWorker[] {
    const tags = [...new Set(gs.event.tags.concat(gs.shift.tags, gs.slot.tags))]

    const workersDisallowed = [] as number[]
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
                        workersDisallowed.push(worker.id)
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

    // Return all possibilities, but with higher affinities first
    const results = [] as EligibleWorker[]
    for (const workerId of workersRequired) {
        if (workersDisallowed.includes(workerId)) {
            continue
        }

        results.push({
            workerId,
            affinity: AssignmentAffinity.Required
        })
    }
    for (const workerId of workersPreferred) {
        if (workersDisallowed.includes(workerId)) {
            continue
        }
        
        results.push({
            workerId,
            affinity: AssignmentAffinity.Preferred
        })
    }
    for (const workerId of workersNeutral) {
        if (workersDisallowed.includes(workerId)) {
            continue
        }
        
        results.push({
            workerId,
            affinity: AssignmentAffinity.Neutral
        })
    }
    for (const workerId of workersUnwanted) {
        if (workersDisallowed.includes(workerId)) {
            continue
        }
        
        results.push({
            workerId,
            affinity: AssignmentAffinity.Unwanted
        })
    }
    return results
}

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

// Calculate a grade for a schedule based on its coverage and alignment with tag
// affinity suggestions (affinity requirements are already considered during the
// generation process).
export function getScheduleGrade(schedule: Schedule) {
    const grade: ScheduleGrade = {
        overall: 0,
        components: []
    }

    // Get generation slots for the schedule so it's easier to work with for
    // aggregate calculations
    const gss = newGenerationSlots(schedule.events)

    // Slot coverage: What percentage of the total number of slots in the
    // schedule have been filled?
    const numSlots = gss.length
    const numFilled = gss.filter((gs) => gs.slot.workerId !== undefined && gs.slot.workerId !== 0).length
    grade.components.push({
        name: 'Overall Slot Coverage',
        weight: 75,
        value: (100.0 * numFilled) / numSlots
    })

    // Slot affinity: Relative distribution of positive, neutral, and negative
    // affinities between workers and events/shifts/slots at a basic level
    // TODO: Improve this logic
    let affinityBuffer = 0
    for (const gs of gss) {
        switch (gs.slot.affinity) {
            case AssignmentAffinity.Required: {
                affinityBuffer += 3
                break
            }
            case AssignmentAffinity.Preferred: {
                affinityBuffer += 2
                break
            }
            case AssignmentAffinity.Neutral: {
                affinityBuffer++
                break
            }
            case AssignmentAffinity.Unwanted: {
                affinityBuffer--
                break
            }
        }
    }
    grade.components.push({
        name: 'General Slot Affinity',
        weight: 25,
        value: (100.0 * affinityBuffer) / (numSlots)
    })

    // Determine overall grade from components
    let buffer = 0
    for (const component of grade.components) {
        buffer += (component.weight / 100.0) * component.value
    }
    grade.overall = Math.min(100, buffer)

    return grade
}

// Convert a base-10 number into an array of digits representing a number of an
// arbitrary base. Example: original = 10, base = 2 returns [1,0,1,0]. This is
// used for comprehensive schedule generation to convert a single seed number
// into usable slot assignments.
export function getBase10toBaseX(original: number, base: number, arrayPadding?: number) {
    // Determine the highest power we need to work with
    let topPower = 0
    for (let i = 0; ; i++) {
        if (Math.pow(base, i) > original) {
            topPower = i - 1
            break
        }
    }

    // Iterate down from the highest power, reducing our accumulator
    const results = [] as number[]
    let balance = original
    for (let i = topPower; i >= 0; i--) {
        for (let j = 0; j < base; j++) {
            // If this power is higher than the remaining balance on its own,
            // skip it and move down
            if (Math.pow(base, i) > balance) {
                results.push(0)
                break
            }

            // Otherwise, calculat our limit within this power
            const p = j * Math.pow(base, i)

            if (p > balance) {
                results.push(j - 1)
                balance -= (j - 1) * Math.pow(base, i)
                break
            } else if (j === base - 1) {
                results.push(j)
                balance -= p
                break
            }
        }
    }

    // Pad the results as needed
    if (arrayPadding !== undefined) {
        const diff = arrayPadding - results.length
        for (let i = 0; i < diff; i++) {
            results.unshift(0)
        }
    }

    return results
}
