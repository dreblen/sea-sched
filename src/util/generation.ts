import type { EligibleWorker, GradeComponent, Scope, ScopeEvent, ScheduleGrade, Schedule, ScheduleEvent, ScheduleShape, ScheduleShift, ScheduleSlot, Tag, TagAffinity, TagAffinityMapMap, Worker } from '@/types'
import { AssignmentAffinity, AssignmentAffinityType, GradeComponentType, TagType } from '@/types'
import md5 from 'md5'

import * as utilDate from '@/util/date'
import * as utilNumber from '@/util/number'

/**
 * Flat representation of a event/shift/slot combination. The slot property is a
 * member of shift.slots, and the shift property is a member of event.shifts.
 */
export interface GenerationSlot {
    event: ScheduleEvent
    shift: ScheduleShift
    slot: ScheduleSlot
}

/**
 * Create a new set of generation slots based on an events list.
 * 
 * @param events List of scope or schedule events to flatten.
 * @returns Array of flat GenerationSlot objects representing all slots in the
 * specified schedule.
 */
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

/**
 * Calculates an MD5 hash representing the state of a specified Scope object.
 * This can be used to compare the current parameters to those used to generate
 * a previous schedule to see if they are compatible.
 * 
 * @param scope The scope to calculate a hash value for.
 * @param tags List of tags to use for ID lookups (e.g., setup.tags).
 * @returns MD5 hash of the specified scope.
 */
export function getScopeHash(scope: Scope, tags: Tag[]) {
    interface CoreTagged {
        name: string
        tags: string[]
    }
    interface CoreSlot extends CoreTagged {
        groupId: number
        isRequired: boolean
    }
    interface CoreShift extends CoreTagged {
        slots: CoreSlot[]
    }
    interface CoreEvent extends CoreTagged {
        shifts: CoreShift[]
        calendarDate: string
    }

    const tagLookupMapper = (id: number): string => (tags.find((t) => t.id === id)?.name || '<invalid>')

    const coreData = [] as CoreEvent[]
    for (const event of scope.events) {
        const newEvent: CoreEvent = {
            name: event.name,
            tags: event.tags.map(tagLookupMapper),
            shifts: [],
            calendarDate: event.calendarDate
        }
        for (const shift of event.shifts) {
            const newShift: CoreShift = {
                name: shift.name,
                tags: shift.tags.map(tagLookupMapper),
                slots: []
            }
            for (const slot of shift.slots) {
                newShift.slots.push({
                    name: slot.name,
                    tags: slot.tags.map(tagLookupMapper),
                    groupId: slot.groupId,
                    isRequired: slot.isRequired
                })
            }
            newEvent.shifts.push(newShift)
        }
        coreData.push(newEvent)
    }

    return md5(JSON.stringify(coreData))
}

/**
 * Simple mapping of specific affinities to their general type.
 * 
 * @param value An assignment affinity.
 * @returns The type the input affinity belongs to.
 */
export function getAssignmentAffinityType(value?: AssignmentAffinity) {
    switch (value) {
        case AssignmentAffinity.Disallowed:
        case AssignmentAffinity.Unwanted:
            return AssignmentAffinityType.Negative
        case AssignmentAffinity.Required:
        case AssignmentAffinity.Preferred:
            return AssignmentAffinityType.Positive
        default:
            return AssignmentAffinityType.Neutral
    }
}

/**
 * Determine a prioritized list of workers who are able to fill a specified
 * slot, along with an indicator of what affinity the workers in that list will
 * have with the slot.
 * 
 * @param gs The flat generation slot being considered for scheduling.
 * @param schedule The full schedule to provide context for the generation slot.
 * @param workers List of workers to use for ID lookups (e.g., setup.workers).
 * @param tags List of tags to use for ID lookups (e.g., setup.tags).
 * @param affinitiesByTagTag Mapping of tag-to-tag affinities (e.g.,
 * setup.affinitiesByTagTag).
 * @param scheduleShape Configuration of schedule shaping controls (e.g.,
 * setup.scheduleShape).
 * @param returnAll If true, all workers considered will be returned with their
 * affinity, even if that is "disallowed."
 * @returns List of worker IDs, assignment affinities, and associated
 * descriptive notes.
 */
export function getEligibleWorkersForSlot(gs: GenerationSlot, schedule: Schedule, workers: Worker[], tags: Tag[], affinitiesByTagTag: TagAffinityMapMap, scheduleShape: ScheduleShape, returnAll?: boolean): EligibleWorker[] {
    // Gather context data about slots that are in the same shift as the one
    // being considered for assignment
    const siblingSlots = gs.shift.slots.filter((l) => l.groupId === gs.slot.groupId && l.id !== gs.slot.id)
    const siblingWorkers = siblingSlots
        .map((slot) => workers.find((w) => w.id === slot.workerId))
        .filter((w) => w !== undefined)
    const siblingWorkerTags = siblingWorkers.reduce((t, w) => t.concat(w.tags),[] as number[])

    // Gather context data about the schedule's segments relevant for the
    // generation slot being considered. This is used to test limits, but we
    // don't want to recalculate it per worker/limit.
    const scheduleDateStart = schedule.events.reduce((p, v) => (v.calendarDate < p) ? v.calendarDate : p,'9999-01-01')
    const scheduleDateEnd = schedule.events.reduce((p, v) => (v.calendarDate > p) ? v.calendarDate : p,'0000-01-01')
    const scheduleScope = utilDate.getMonthsAndWeeksFromDateRange(scheduleDateStart, scheduleDateEnd)
    const thisMonth = scheduleScope.months.find((m) => gs.event.calendarDate >= m.dateStart && gs.event.calendarDate <= m.dateEnd)
    const thisWeek = scheduleScope.weeks.find((w) => gs.event.calendarDate >= w.dateStart && gs.event.calendarDate <= w.dateEnd)

    // Build a list of tags that need to be considered for affinities
    const slotTags = [...new Set(gs.event.tags.concat(gs.shift.tags, gs.slot.tags))]

    const workerAffinities = [] as { workerId: number, affinity: AssignmentAffinity, notes?: string[] }[]
    for (const worker of workers) {
        // If this worker is already assigned to a slot in the same shift, they
        // are not eligible for this slot
        if (gs.shift.slots.find((s) => s.workerId === worker.id)) {
            continue
        }

        ////////////////////////////////////////////////////////////////////////
        // Check the worker's unavailability
        ////////////////////////////////////////////////////////////////////////
        let isUnavailable = false
        let unavailableAffinity = AssignmentAffinity.Unwanted
        let unavailableNotes = ''
        for (const unavailableDate of worker.unavailableDates) {
            // If we have a required answer already, don't proceed
            if (isUnavailable && unavailableAffinity !== AssignmentAffinity.Unwanted) {
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
                if (unavailableDate.isRequired) {
                    unavailableAffinity = AssignmentAffinity.Disallowed
                }
                unavailableNotes = unavailableDate.notes
                break
            }

            // For dates inside the unavailability boundaries, test tags
            let allMatched = true
            for (const id of unavailableDate.tags) {
                const tagMatch = slotTags.includes(id)

                // When the tag logic allows for any match, we have an answer
                // after the first positive check
                if (unavailableDate.tagLogic === 'any' && tagMatch) {
                    isUnavailable = true
                    if (unavailableDate.isRequired) {
                        unavailableAffinity = AssignmentAffinity.Disallowed
                    }
                    unavailableNotes = unavailableDate.notes
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
                if (unavailableDate.isRequired) {
                    unavailableAffinity = AssignmentAffinity.Disallowed
                }
                unavailableNotes = unavailableDate.notes
                break
            }
        }
        if (isUnavailable) {
            workerAffinities.push({ workerId: worker.id, affinity: unavailableAffinity, notes: [unavailableNotes || 'Unavailable'] })
            continue
        }

        ////////////////////////////////////////////////////////////////////////
        // Check the worker's limits
        ////////////////////////////////////////////////////////////////////////
        let limitAffinity = AssignmentAffinity.Neutral
        let limitNotes = [] as string[]
        if (worker.eventLimit > 0 || worker.weekLimit > 0 || worker.monthLimit > 0) {
            // Check if we have reached our event limit
            if (worker.eventLimit > 0) {
                const numAssignments = gs.event.shifts
                    .filter((s) => s.slots.filter((l) => l.workerId === worker.id).length > 0)
                    .length
                if (numAssignments >= worker.eventLimit) {
                    const note = `Event Limit (${worker.eventLimit})`
                    if (worker.eventLimitRequired) {
                        workerAffinities.push({ workerId: worker.id, affinity: AssignmentAffinity.Disallowed, notes: [note] })
                        continue
                    } else {
                        limitAffinity = AssignmentAffinity.Unwanted
                        limitNotes.push(note)
                    }
                }
            }

            // Check if we have reached our week limit
            if (worker.weekLimit > 0 && thisWeek !== undefined) {
                const numAssignments = schedule.events
                    .filter((e) => e.calendarDate >= thisWeek.dateStart && e.calendarDate <= thisWeek.dateEnd)
                    .reduce((t,e) => t + e.shifts.reduce((t,s) => t + s.slots.filter((l) => l.workerId === worker.id).length,0),0)
                
                if (numAssignments >= worker.weekLimit) {
                    const note = `Week Limit (${worker.weekLimit})`
                    if (worker.weekLimitRequired) {
                        workerAffinities.push({ workerId: worker.id, affinity: AssignmentAffinity.Disallowed, notes: [note] })
                        continue
                    } else {
                        limitAffinity = AssignmentAffinity.Unwanted
                        limitNotes.push(note)
                    }
                }
            }

            // Check if we have reached our month limit
            if (worker.monthLimit > 0 && thisMonth !== undefined) {
                const numAssignments = schedule.events
                    .filter((e) => e.calendarDate >= thisMonth.dateStart && e.calendarDate <= thisMonth.dateEnd)
                    .reduce((t,e) => t + e.shifts.reduce((t,s) => t + s.slots.filter((l) => l.workerId === worker.id).length,0),0)
                
                if (numAssignments >= worker.monthLimit) {
                    const note = `Month Limit (${worker.monthLimit})`
                    if (worker.monthLimitRequired) {
                        workerAffinities.push({ workerId: worker.id, affinity: AssignmentAffinity.Disallowed, notes: [note] })
                        continue
                    } else {
                        limitAffinity = AssignmentAffinity.Unwanted
                        limitNotes.push(note)
                    }
                }
            }
        }
        if (limitAffinity !== AssignmentAffinity.Neutral) {
            workerAffinities.push({ workerId: worker.id, affinity: limitAffinity, notes: limitNotes })
        }

        ////////////////////////////////////////////////////////////////////////
        // Check for any schedule shaping requirements
        ////////////////////////////////////////////////////////////////////////

        if (scheduleShape.minWeeksBetweenEventShift > 0) {
            // Identify the event and shift tags associated with the current
            // slot so we can confidently make comparisons even if they have
            // been renamed in the parameters stage
            const eventTag = gs.event.tags.find((id) => {
                const tag = tags.find((t) => t.id === id)
                if (!tag) {
                    return false
                }

                return tag.type === TagType.Event
            })
            const shiftTag = gs.shift.tags.find((id) => {
                const tag = tags.find((t) => t.id === id)
                if (!tag) {
                    return false
                }

                return tag.type === TagType.Shift
            })

            if (eventTag && shiftTag) {
                // Work backwards from this event in the schedule trying to find
                // another assignment of this worker in the same type of shift
                const previousEvents = schedule.events
                    .filter((e) => e.calendarDate < gs.event.calendarDate)
                    .sort((a,b) => {
                        if (a.calendarDate > b.calendarDate) {
                            return -1
                        }
                        if (a.calendarDate < b.calendarDate) {
                            return 1
                        }
                        return 0
                    })
                let mostRecentDate = ''
                for (const pe of previousEvents) {
                    if (pe.tags.includes(eventTag)) {
                        const shift = pe.shifts.find((s) => s.tags.includes(shiftTag))
                        if (shift) {
                            const slot = shift.slots.find((l) => l.workerId === worker.id)
                            if (slot) {
                                mostRecentDate = pe.calendarDate
                                break
                            }
                        }
                    }
                }

                // If we found a match, determine the number of weeks between it
                // and the current slot under consideration
                if (mostRecentDate !== '') {
                    // Get the first day of the week for the current slot
                    const slotDate = utilDate.getNormalizedDate(gs.event.calendarDate)
                    const slotDayOfWeek = slotDate.getDay()
                    slotDate.setDate(slotDate.getDate() - slotDayOfWeek)
                    
                    // Get the first day of the week for the previous assignment
                    const previousDate = utilDate.getNormalizedDate(mostRecentDate)
                    const previousDayOfWeek = previousDate.getDay()
                    previousDate.setDate(previousDate.getDate() - previousDayOfWeek)

                    // Determine the gap between the assignments
                    const msInDay = 1000 * 60 * 60 * 24
                    const daysBetween = (slotDate.getTime() - previousDate.getTime()) / msInDay
                    const weeksBetween = daysBetween / 7

                    // Make sure we have met the requirement
                    if (weeksBetween <= scheduleShape.minWeeksBetweenEventShift) {
                        workerAffinities.push({ workerId: worker.id, affinity: AssignmentAffinity.Disallowed, notes: [`Shape: Min Weeks Between Event+Shift (${scheduleShape.minWeeksBetweenEventShift})`] })
                        continue
                    }
                }
            }
        }

        ////////////////////////////////////////////////////////////////////////

        // If there are no tags to consider for this slot/worker, the worker is
        // eligible from this perspective
        if ((slotTags.length === 0 && siblingWorkerTags.length === 0) || worker.tags.length === 0) {
            workerAffinities.push({ workerId: worker.id, affinity: AssignmentAffinity.Neutral })
            continue
        }

        // If this worker has no tag affinities, they are eligible
        const affinityMaps = worker.tags.map((t) => affinitiesByTagTag[t])
        if (affinityMaps.length === 0) {
            workerAffinities.push({ workerId: worker.id, affinity: AssignmentAffinity.Neutral })
            continue
        }

        ////////////////////////////////////////////////////////////////////////
        // Check for tag affinities between this worker and the slot, or between
        // this worker and a worker assigned to a sibling slot
        ////////////////////////////////////////////////////////////////////////
        const allTags = [...new Set([...slotTags, ...siblingWorkerTags])]
        let isStopShort = false
        for (const affinityMap of affinityMaps) {
            // If we've reached a condition that requires no further iterations,
            // stop processing
            if (isStopShort) {
                break
            }

            if (affinityMap === undefined) {
                continue
            }

            for (const tag of allTags) {
                const affinity = affinityMap[tag]
                const notes = [`${affinity?.tagId1}|${affinity?.tagId2}`]
                
                // Required affinities take first priority
                if (affinity?.isRequired) {
                    // If there is a positive, required affinity, add the worker
                    // to the required workers list
                    if (affinity.isPositive) {
                        workerAffinities.push({ workerId: worker.id, affinity: AssignmentAffinity.Required, notes })
                        continue
                    }
                    // If there is a negative, required affinity, exclude the
                    // worker from consideration for this slot
                    else {
                        workerAffinities.push({ workerId: worker.id, affinity: AssignmentAffinity.Disallowed, notes })
                        isStopShort = true
                        break
                    }
                }
                // Optional affinities are preferences
                else {
                    // Positive means we should try to make this assignment
                    if (affinity?.isPositive) {
                        workerAffinities.push({ workerId: worker.id, affinity: AssignmentAffinity.Preferred, notes })
                        continue
                    }
                    // Negative means we should try to avoid this assignment
                    else if (affinity?.isPositive === false) {
                        workerAffinities.push({ workerId: worker.id, affinity: AssignmentAffinity.Unwanted, notes })
                        continue
                    }
                }

                // Add any other workers to the eligible list for this slot
                workerAffinities.push({ workerId: worker.id, affinity: AssignmentAffinity.Neutral })
            }
        }
    }

    // For optional slots, add the special "no assignment" worker ID since that
    // is a valid option to consider. Whether or not it's a good option is
    // deferred to the grading process. We don't do this for required slots
    // because there's no value in doing so like there is for optional ones.
    if (gs.slot.isRequired === false) {
        workerAffinities.push({ workerId: 0, affinity: AssignmentAffinity.Neutral })
    }

    // Unless we've been told to return all workers with their affinities, don't
    // consider any workers who had at least one "disallowed" affinity, and if
    // there are any workers with a required affinity, only consider them
    const disallowedWorkersIds = workerAffinities
        .filter((wa) => wa.affinity === AssignmentAffinity.Disallowed)
        .map((wa) => wa.workerId)
    const requiredWorkerIds = workerAffinities
        .filter((wa) => wa.affinity == AssignmentAffinity.Required)
        .map((wa) => wa.workerId)

    let possibleWorkerIds = [] as number[]
    if (returnAll !== true) {
        possibleWorkerIds = [...new Set(workerAffinities
            .filter((wa) => !disallowedWorkersIds.includes(wa.workerId))
            .filter((wa) => requiredWorkerIds.length > 0 ? requiredWorkerIds.includes(wa.workerId) : true)
            .map((wa) => wa.workerId)
        )]
    } else {
        possibleWorkerIds = [...new Set(workerAffinities.map((wa) => wa.workerId))]
    }

    // Determine a single affinity for each possible worker and add it to the
    // results that we return. We prefer positive or negative over neutral, but
    // negative over positive.
    const results = [] as EligibleWorker[]
    for (const workerId of possibleWorkerIds) {
        // If this worker has a disallowed affinity, it wins over anything
        let affinity = AssignmentAffinity.Neutral
        if (disallowedWorkersIds.includes(workerId)) {
            affinity = AssignmentAffinity.Disallowed
        }
        // If they have a required affinity, it comes next
        else if (requiredWorkerIds.includes(workerId)) {
            affinity = AssignmentAffinity.Required
        }
        // In all other cases, apply the general logic described above
        else {
            affinity = workerAffinities
                .filter((wa) => wa.workerId === workerId)
                .reduce((p: AssignmentAffinity, wa) => {
                    const lastType = getAssignmentAffinityType(p)
                    const thisType = getAssignmentAffinityType(wa.affinity)
                    switch (thisType) {
                        case AssignmentAffinityType.Negative:
                            return wa.affinity
                        case AssignmentAffinityType.Positive:
                            if (lastType !== AssignmentAffinityType.Negative) {
                                return wa.affinity
                            } else {
                                return p
                            }
                        default:
                            return p
                    }

                }, AssignmentAffinity.Neutral)
        }

        // Combine all unique notes specified at our target affinity
        const allNotes = workerAffinities
            .filter((wa) =>
                wa.workerId === workerId
                && wa.affinity === affinity
                && wa.notes !== undefined && wa.notes.length > 0
            )
            .map((wa) => wa.notes as string[])
            .flat()
        const uniqueNotes = [...new Set(allNotes)]

        // Finalize our results for this slot/worker
        results.push({
            workerId,
            affinity,
            affinityNotes: (uniqueNotes.length > 0) ? uniqueNotes : undefined
        })
    }

    return results
}

/**
 * Calculate a grade for a schedule based on its coverage and alignment with tag
 * affinity suggestions (affinity requirements are already considered during the
 * generation process). Other factors are included, and their relative
 * importance is controlled by user-configured grade weighting values.
 * 
 * @param schedule The full schedule to determine a grade for.
 * @param availableWorkers List of workers that should be considered as being
 * available for scheduling when making calculations like assignment count
 * balance (e.g., setup.workers where isActive == true).
 * @param tagAffinities List of configured tag affinities that should be
 * considered when evaluating what would be the best possible affinity alignment
 * (e.g., setup.tagAffinities).
 * @param gradeComponents List of configured grade weighting values to use for
 * final calculations (e.g., setup.gradeComponents).
 * @returns New schedule grade object containing an overall score and results
 * for each of the specified components.
 */
export function getScheduleGrade(schedule: Schedule, availableWorkers: Worker[], tagAffinities: TagAffinity[], gradeComponents: GradeComponent[]) {
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
        const requiredSlots = gss.filter((gs) => gs.slot.isRequired)
        const optionalSlots = gss.filter((gs) => !gs.slot.isRequired)

        const requiredFilled = requiredSlots.filter((gs) => gs.slot.workerId !== undefined && gs.slot.workerId !== 0).length
        const optionalFilled = optionalSlots.filter((gs) => gs.slot.workerId !== undefined && gs.slot.workerId !== 0).length

        let requiredPorition = 100.0 * requiredFilled / requiredSlots.length
        let optionalPortion = 100.0 * optionalFilled / optionalSlots.length

        // If either of these have zero slots, upgrade them to 100% since it
        // shouldn't penalize a category if it's not relevant, unless this is
        // the one comprehensive-method scenario that assigns no workers to any
        // slot, in which case we treat these as zeroes to push this permutation
        // down in the results.
        if (isNaN(requiredPorition)) {
            if (optionalFilled > 0) {
                requiredPorition = 100
            } else {
                requiredPorition = 0
            }
        }
        if (isNaN(optionalPortion)) {
            if (requiredFilled > 0) {
                optionalPortion = 100
            } else {
                optionalPortion = 0
            }
        }

        grade.components.push({
            componentId: GradeComponentType.SlotCoverageRequired,
            value: requiredPorition
        })

        grade.components.push({
            componentId: GradeComponentType.SlotCoverageOptional,
            value: optionalPortion
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

        // - Calculate the total number of worker assignments in the schedule
        // and convert our per-worker counts into percentages so we can
        // determine a normalized count balance.
        const totalNumAssignments = numAssignments.reduce((t,v) => t+v,0.0)
        const numAssignmentsAsPercentages = numAssignments.map((n) => n / totalNumAssignments)
        const numAssignmentsMaxPercentage = numAssignmentsAsPercentages.reduce((p,v) => (v > p) ? v : p,0)
        const numAssignmentsMinPercentage = numAssignmentsAsPercentages.reduce((p,v) => (v < p) ? v : p,1)

        // - Calcualte the standard deviation for the assignment spacing, along
        // with the baseline average for comparison when determining the final
        // grade
        const avgAssignmentSpacing = avgAssignmentSpacings.reduce((t,v) => t+v,0.0) / avgAssignmentSpacings.length
        const assignmentSpacingStandardDeviation = utilNumber.getStandardDeviation(avgAssignmentSpacings)

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
        let numAssignmentPortion = 1.0 - (numAssignmentsMaxPercentage - numAssignmentsMinPercentage)
        if (totalNumAssignments === 0) {
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
            if (totalNumAssignments === 0) {
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
            componentId: GradeComponentType.BalanceCount,
            value: 100.0 * Math.max(0,numAssignmentPortion)
        })
        grade.components.push({
            componentId: GradeComponentType.BalanceSpacing,
            value: 100.0 * Math.max(0,assignmentSpacingPortion)
        })
        grade.components.push({
            componentId: GradeComponentType.BalanceDistribution,
            value: 100.0 * spreadPortion
        })
    }

    ////////////////////////////////////////////////////////////////////////////
    // Variety of assignments: Frequency of assignment to different shifts and
    // slots. The value here is similar in calculation to the Balance component.
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
        const shiftsStandardDeviation = utilNumber.getStandardDeviation(numUniqueShiftsPerWorker)
        const avgUniqueSlots = numUniqueSlotsPerWorker.reduce((t,v) => t+v,0.0) / numUniqueSlotsPerWorker.length
        const slotsStandardDeviation = utilNumber.getStandardDeviation(numUniqueSlotsPerWorker)

        // - Finalize our grade
        let shiftPortion = (avgUniqueShifts - (shiftsStandardDeviation / numUniqueShifts)) / numUniqueShifts
        let slotPortion = (avgUniqueSlots - (slotsStandardDeviation / numUniqueSlots)) / numUniqueSlots
        if (isNaN(shiftPortion) || isNaN(slotPortion)) {
            // This will happen in the one comprehensive-generation scenario
            // described above regarding balance. If this happens, we want to
            // downgrade the result.
            shiftPortion = 0.0
            slotPortion = 0.0
        }
        grade.components.push({
            componentId: GradeComponentType.VarietyAssignments,
            value: 100.0 * (shiftPortion + slotPortion) / 2
        })
    }

    ////////////////////////////////////////////////////////////////////////////
    // Variety of coworkers: Frequency of assignments with different workers.
    // Higher grades come when not always scheduled with the same person.
    ////////////////////////////////////////////////////////////////////////////
    {
        // - Make a cross join between all the workers that appear in the
        // schedule with an indicator for whether or not the combination appears
        let numUniqueWorkerPairs = 0
        const workerPairFlags = {} as {
            [workerId1: number]: {
                [workerId2: number]: boolean
            }
        }
        const scheduleWorkerIds = [...new Set(gss.map((gs) => gs.slot.workerId).filter((id) => id !== undefined && id !== 0) as number[])]
        for (const id1 of scheduleWorkerIds) {
            const comparisonWorkerIds = scheduleWorkerIds.filter((id) => id < id1)
            for (const id2 of comparisonWorkerIds) {
                if (workerPairFlags[id1] === undefined) {
                    workerPairFlags[id1] = {}
                }
                if (workerPairFlags[id1][id2] === undefined) {
                    workerPairFlags[id1][id2] = false
                    numUniqueWorkerPairs++
                }
            }
        }

        // - Iterate the schedule assignments to test each eligible combination
        for (const gs of gss) {
            // Skip non-assignments
            if (gs.slot.workerId === undefined || gs.slot.workerId === 0) {
                continue
            }

            // Iterate neighboring slots
            for (const slot of gs.shift.slots) {
                // Skip our base slot
                if (slot.id === gs.slot.id) {
                    continue
                }

                // Skip non-assignments
                if (slot.workerId === undefined || slot.workerId === 0) {
                    continue
                }

                // Mark this combination as having occurred
                const baseList = workerPairFlags[gs.slot.workerId]
                if (baseList !== undefined) {
                    if (baseList[slot.workerId] !== undefined) {
                        baseList[slot.workerId] = true
                    }
                }
            }
        }

        // - Count the number of unique pairs that occurred
        let numOccurredPairs = 0
        for (const id1 of Object.keys(workerPairFlags)) {
            const set = workerPairFlags[parseInt(id1)]
            if (set === undefined) {
                continue
            }

            for (const id2 of Object.keys(set)) {
                const flag = set[parseInt(id2)]
                if (flag === true) {
                    numOccurredPairs++
                }
            }
        }

        // - Finalize our grade
        let finalGrade = numOccurredPairs / numUniqueWorkerPairs
        if (isNaN(finalGrade)) {
            finalGrade = 0
        }

        grade.components.push({
            componentId: GradeComponentType.VarietyCoworkers,
            value: 100.0 * finalGrade
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
            // Don't count this "affinity" if it's a non-assignment
            if (gs.slot.workerId === undefined || gs.slot.workerId === 0) {
                continue
            }

            const type = getAssignmentAffinityType(gs.slot.affinity);
            (numAffinities[type] as number)++
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
            componentId: GradeComponentType.TagAffinity,
            value: 100.0 * gradeValue
        })
    }

    ////////////////////////////////////////////////////////////////////////////
    // Determine overall grade from components
    ////////////////////////////////////////////////////////////////////////////
    let buffer = 0
    for (const component of grade.components) {
        // Look up the definition of this component, and skip it if we can't for
        // some reason
        const componentDefinition = gradeComponents.find((gc) => gc.id === component.componentId)
        if (componentDefinition === undefined) {
            continue
        }

        // Normalize the grades to one decimal
        component.value = Math.round(component.value * 10) / 10

        // Add to the overall total
        buffer += (componentDefinition.weight / 100.0) * component.value
    }
    grade.overall = Math.min(100, buffer)
    grade.overall = Math.round(grade.overall * 10) / 10

    return grade
}
