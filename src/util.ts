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

import type { GenericEvent, GenericShift, GenericSlot, TagAffinity, TagType } from '@/types'

export interface EventManagementStore {
    addEvent: { (): GenericEvent|void }
    removeEvent: { (eventId?: number): void }
    addEventShift: { (eventId: number): GenericShift|void }
    removeEventShift: { (eventId?: number, shiftId?: number): void }
    addShiftSlot: { (eventId: number, shiftId: number): GenericSlot|void }
    removeShiftSlot: { (eventId?: number, shiftId?: number, slotId?: number): void }
    syncSystemTags?: { (type: TagType): void}
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

        // Check the worker's unavailability
        let isUnavailable = false
        for (const unavailableDate of worker.unavailableDates) {
            // If we have an answer already, don't proceed
            if (isUnavailable) {
                break
            }

            // If this event is outside the unavailability boundaries, skip it
            if (gs.event.calendarDate < unavailableDate.dateStart || gs.event.calendarDate > unavailableDate.dateEnd) {
                continue
            }

            // If the unavailability date has no tags, there is nothing further
            // to check
            if (unavailableDate.tags.length === 0) {
                isUnavailable = true
                break
            }

            // For dates inside the unavailability boundaries, test tags
            let allMatched = true
            for (const id of unavailableDate.tags) {
                const tagMatch = tags.includes(id)

                // When the tag logic allows for any match, we have an answer
                // after the first positive check
                if (unavailableDate.tagLogic === 'any' && tagMatch) {
                    isUnavailable = true
                    break
                }

                // When the tag logic requires every tag to match, we have an
                // answer only after we're finished or when we have our first
                // negative check
                if (unavailableDate.tagLogic === 'all' && !tagMatch) {
                    allMatched = false
                    break
                }
            }

            // Finish out the "all" tag logic
            if (unavailableDate.tagLogic === 'all' && allMatched) {
                isUnavailable = true
                break
            }
        }
        if (isUnavailable) {
            workersDisallowed.push(worker.id)
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
    for (const workerId of workersUnwanted) {
        if (workersDisallowed.includes(workerId)) {
            continue
        }
        
        results.push({
            workerId,
            affinity: AssignmentAffinity.Unwanted
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

export function getStandardDeviation(valueList: number[]) {
    const avgValue = valueList.reduce((t,v) => t+v,0.0) / valueList.length
    const deviations = valueList.map((v) => Math.pow(v - avgValue,2))
    const numAssignmentVariance = deviations.reduce((t,v) => t+v,0.0) / deviations.length
    return Math.sqrt(numAssignmentVariance)
}

// Calculate a grade for a schedule based on its coverage and alignment with tag
// affinity suggestions (affinity requirements are already considered during the
// generation process).
export function getScheduleGrade(schedule: Schedule, availableWorkers: Worker[], tagAffinities: TagAffinity[]) {
    const grade: ScheduleGrade = {
        overall: 0,
        components: []
    }

    // Get generation slots for the schedule so it's easier to work with for
    // aggregate calculations. We sort it by date, shift ID, and slot ID so we
    // can test assignment balance later.
    const gss = newGenerationSlots(schedule.events)
    gss.sort((a,b) => {
        if (a.event.calendarDate < b.event.calendarDate) {
            return -1
        }
        if (a.event.calendarDate > b.event.calendarDate) {
            return 1
        }

        if (a.shift.id < b.shift.id) {
            return -1
        }
        if (a.shift.id > b.shift.id) {
            return 1
        }

        if (a.slot.id < b.slot.id) {
            return -1
        }
        if (a.slot.id > b.slot.id) {
            return 1
        }

        return 0
    })

    ////////////////////////////////////////////////////////////////////////////
    // Slot coverage: What percentage of the total number of slots in the
    // schedule have been filled?
    ////////////////////////////////////////////////////////////////////////////
    {
        const numFilled = gss.filter((gs) => gs.slot.workerId !== undefined && gs.slot.workerId !== 0).length
        grade.components.push({
            name: 'Overall Slot Coverage',
            weight: 75,
            value: (100.0 * numFilled) / gss.length
        })
    }

    ////////////////////////////////////////////////////////////////////////////
    // Balance: Consistency of spacing from one slot assignment to the next for
    // each worker. Frequent assignments will not result in a low grade if every
    // worker is scheduled frequently, but some workers with frequent
    // assignments and some with sparse assignments will lower the grade. This
    // also looks at objectively spreading assignments over the course of the
    // schedule so you don't end up with, for example, two back-to-back
    // assignments in the first two weeks for one worker and two back-to-back
    // assignments in the last two weeks for another worker.
    ////////////////////////////////////////////////////////////////////////////
    {
        // - Start by gathering raw data on assignment spacing for each worker
        const stepBufferByWorker = {} as { [workerId: number]: number }
        const assignmentSpacingByWorker = {} as { [workerId: number]: number[] }
        const assignmentStepsByWorker = {} as { [workerId: number]: number[] }
        let lastEventId = -1
        let lastShiftId = -1
        let step = 0
        for (const gs of gss) {
            // Track when we're looking at a new event/shift
            if (gs.event.id !== lastEventId || gs.shift.id !== lastShiftId) {
                lastEventId = gs.event.id
                lastShiftId = gs.shift.id
                step++
            }

            // If there is no worker assigned to this slot, move on
            if (gs.slot.workerId === undefined || gs.slot.workerId === 0) {
                continue
            }

            // If we have a previous tracker for this worker, calculate the
            // difference and store it
            if (stepBufferByWorker[gs.slot.workerId] !== undefined) {
                const diff = step - (stepBufferByWorker[gs.slot.workerId] as number);

                (assignmentSpacingByWorker[gs.slot.workerId] as number[]).push(diff)
            } else {
                // If this is the first time encountering a worker, record a stub
                // entry in case this ends up being their only shift and there is
                // nothing else to measure
                assignmentSpacingByWorker[gs.slot.workerId] = [0]
            }

            // Store the current step value for the assigned worker, both in our
            // working buffer for spacing calculations and our permanent record
            // for objective spread calculations.
            stepBufferByWorker[gs.slot.workerId] = step
            if (assignmentStepsByWorker[gs.slot.workerId] === undefined) {
                assignmentStepsByWorker[gs.slot.workerId] = []
            }
            (assignmentStepsByWorker[gs.slot.workerId] as number[]).push(step)
        }
        const totalSteps = step

        // - Convert our spacing details into summaries by worker, including workers
        // who didn't make it onto this schedule at all
        const numAssignments = [] as number[]
        const avgAssignmentSpacings = [] as number[]
        for (const workerId of availableWorkers.map((w) => w.id)) {
            const set = assignmentSpacingByWorker[workerId]
            if (set === undefined) {
                numAssignments.push(0)
            } else {
                numAssignments.push(set.length)
                avgAssignmentSpacings.push(set.reduce((t,v) => t+v,0.0) / set.length)
            }
        }

        // - Calcualte the standard deviation for the assignment counts and spacing,
        // along with the baseline averages for comparison when determining the
        // final grade
        const avgNumAssignment = numAssignments.reduce((t,v) => t+v,0.0) / numAssignments.length
        const numAssignmentStandardDeviation = getStandardDeviation(numAssignments)
        const avgAssignmentSpacing = avgAssignmentSpacings.reduce((t,v) => t+v,0.0) / avgAssignmentSpacings.length
        const assignmentSpacingStandardDeviation = getStandardDeviation(avgAssignmentSpacings)

        // - Convert our assignment step details into segment summaries by
        // worker so we can calculate spread
        const spreadGradesPerWorker = [] as number[]
        for (const workerId of Object.keys(assignmentStepsByWorker)) {
            const workerSteps = assignmentStepsByWorker[parseInt(workerId)] as number[]

            // Divide our total number of steps by the number of assignments for
            // this worker so we can build equal segments appropriate to this
            // worker's assignments
            const increment = totalSteps / workerSteps.length
            const floorSegments = [] as number[]
            const ceilSegments = [] as number[]
            for (let i = 1; (i * increment) <= totalSteps; i++) {
                floorSegments.push(Math.floor(i * increment))
                ceilSegments.push(Math.ceil(i * increment))
            }

            // Determine which segments the worker's assignments fall under, and
            // use that information to calculate a spread grade for the worker
            const gradeBuffers = [] as number[]
            for (const segmentSet of [floorSegments, ceilSegments]) {
                // Gather the raw range data
                const assignmentBuffer = [] as number[]
                for (let step of workerSteps) {
                    for (let i = 0; i < segmentSet.length; i++) {
                        if (step <= (segmentSet[i] as number)) {
                            assignmentBuffer.push(i)
                            break
                        }
                    }
                }

                // Determine the number of unique segments the worker was
                // assigned to, and use that to calculate the spread grade
                const numAssignments = (new Set(assignmentBuffer)).size
                gradeBuffers.push(numAssignments / segmentSet.length)
            }

            // Store the average of our floor and ceiling grades as the final
            // spread grade for the worker
            spreadGradesPerWorker.push(gradeBuffers.reduce((t,v) => t + v,0) / gradeBuffers.length)
        }

        // - Finalize our grade
        let numAssignmentPortion = (avgNumAssignment - numAssignmentStandardDeviation) / avgNumAssignment
        if (isNaN(numAssignmentPortion)) {
            // This would happen only for the one comprehensive-method iteration
            // that assigns no workers to any slots. This is an objectively bad
            // scenario, so we downgrade the balance rating even though it's
            // technically not a problem in this area specifically.
            numAssignmentPortion = 0.0
        }
        let assignmentSpacingPortion = (avgAssignmentSpacing - assignmentSpacingStandardDeviation) / avgAssignmentSpacing
        if (isNaN(assignmentSpacingPortion)) {
            // This would happen if every worker was assigned to only one slot,
            // which is perfect balance, or in the comprehensive-method
            // scenario described above, where we would want to downgrade.
            if (avgNumAssignment === 0) {
                assignmentSpacingPortion = 0.0
            } else {
                assignmentSpacingPortion = 1.0
            }
        }
        let spreadPortion = spreadGradesPerWorker.reduce((t,v) => t + v,0) / spreadGradesPerWorker.length
        if (isNaN(spreadPortion)) {
            // This would happen in the specific comprehensive-method scenario
            // mentioned above that we want to downgrade
            spreadPortion = 0
        }
        grade.components.push({
            name: 'Balance: Count',
            weight: 2.5,
            value: 100.0 * numAssignmentPortion
        })
        grade.components.push({
            name: 'Balance: Spacing',
            weight: 2.5,
            value: 100.0 * assignmentSpacingPortion
        })
        grade.components.push({
            name: 'Balance: Distribution',
            weight: 2.5,
            value: 100.0 * spreadPortion
        })
    }

    ////////////////////////////////////////////////////////////////////////////
    // Variety: Frequency of assignment to different shifts and slots. The value
    // here is similar in calculation to the Balance component.
    ////////////////////////////////////////////////////////////////////////////
    {
        // - Store baseline data on how many unique shifts and slots are
        // available in the schedule
        const numUniqueShifts = [...new Set(gss.map((gs) => gs.shift.name))].length
        const numUniqueSlots = [...new Set(gss.map((gs) => gs.slot.name))].length

        // - Gather raw data on which shifts and slots each worker has been
        // assigned to
        const assignmentsByWorker = {} as { [workerId: number]: { shiftName: string, slotName: string }[] }
        for (const gs of gss) {
            if (gs.slot.workerId === undefined || gs.slot.workerId === 0) {
                continue
            }

            if (assignmentsByWorker[gs.slot.workerId] === undefined) {
                assignmentsByWorker[gs.slot.workerId] = []
            }

            assignmentsByWorker[gs.slot.workerId]?.push({
                shiftName: gs.shift.name,
                slotName: gs.slot.name
            })
        }

        // - Summarize the number of unique shifts and slots for each worker
        const numUniqueShiftsPerWorker = [] as number[]
        const numUniqueSlotsPerWorker = [] as number[]
        for (const workerId in assignmentsByWorker) {
            const pair = assignmentsByWorker[workerId]
            const shiftSet = [...new Set(pair?.map((p) => p.shiftName))]
            const slotSet = [...new Set(pair?.map((p) => p.slotName))]
            numUniqueShiftsPerWorker.push(shiftSet.length)
            numUniqueSlotsPerWorker.push(slotSet.length)
        }

        // - Calculate the standard deviations of our shift and slot numbers
        const avgUniqueShifts = numUniqueShiftsPerWorker.reduce((t,v) => t+v,0.0) / numUniqueShiftsPerWorker.length
        const shiftsStandardDeviation = getStandardDeviation(numUniqueShiftsPerWorker)
        const avgUniqueSlots = numUniqueSlotsPerWorker.reduce((t,v) => t+v,0.0) / numUniqueSlotsPerWorker.length
        const slotsStandardDeviation = getStandardDeviation(numUniqueSlotsPerWorker)

        // - Finalize our grade
        let shiftPortion = (avgUniqueShifts - shiftsStandardDeviation) / numUniqueShifts
        let slotPortion = (avgUniqueSlots - slotsStandardDeviation) / numUniqueSlots
        if (isNaN(shiftPortion) || isNaN(slotPortion)) {
            // This will happen in the one comprehensive-generation scenario
            // described above regarding balance. If this happens, we want to
            // downgrade the result.
            shiftPortion = 0.0
            slotPortion = 0.0
        }
        grade.components.push({
            name: 'Variety',
            weight: 2.5,
            value: 100.0 * (shiftPortion + slotPortion) / 2
        })
    }

    ////////////////////////////////////////////////////////////////////////////
    // Slot affinity: Relative distribution of positive, neutral, and negative
    // affinities between workers and events/shifts/slots at a basic level
    ////////////////////////////////////////////////////////////////////////////
    {
        // - Determine the number of negative, neutral, and positive affinities
        // found in the schedule assignments
        const numAffinities = [0, 0, 0]
        for (const gs of gss) {
            switch (gs.slot.affinity) {
                case AssignmentAffinity.Unwanted:
                    (numAffinities[0] as number)++
                    break
                case AssignmentAffinity.Neutral:
                    (numAffinities[1] as number)++
                    break
                case AssignmentAffinity.Required:
                case AssignmentAffinity.Preferred:
                    (numAffinities[2] as number)++
                    break
            }
        }

        // - Calculate our affinity bias as an average where negative affinities
        // are 0, neutral are 1, and positive are 2
        const totalAffinities = numAffinities.reduce((t,v) => t + v,0)
        const avgAffinity = numAffinities.reduce((t,v,i) => t + (v * i),0) / totalAffinities

        // - Check whether or not any positive affinities were possible for the
        // schedule so we don't grade too harshly
        let hasPositive = false
        for (const affinity of tagAffinities) {
            if (affinity.isPositive) {
                hasPositive = true
                break
            }
        }

        // - Finalize the grade (the idea is that our scores range from 0 to 2,
        // but 2 is only possible if there are positive affinities; if there are
        // none, we score out of the actual highest score of 1, but if there are
        // then we score out of 2)
        let gradeValue = avgAffinity
        if (hasPositive) {
            gradeValue /= 2.0
        }
        if (isNaN(gradeValue)) {
            gradeValue = 0
        }

        grade.components.push({
            name: 'General Slot Affinity',
            weight: 15,
            value: 100.0 * gradeValue
        })
    }

    ////////////////////////////////////////////////////////////////////////////
    // Determine overall grade from components
    ////////////////////////////////////////////////////////////////////////////
    let buffer = 0
    for (const component of grade.components) {
        // Normalize the grades to one decimal
        component.value = Math.round(component.value * 10) / 10

        // Add to the overall total
        buffer += (component.weight / 100.0) * component.value
    }
    grade.overall = Math.min(100, buffer)
    grade.overall = Math.round(grade.overall * 10) / 10

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
