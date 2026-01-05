import type * as SeaSched from '@/types'
import * as util from '@/util'

export interface InboundMessage {
    seed: number
    events: SeaSched.ScheduleEvent[]
    workers: SeaSched.Worker[]
    affinitiesByTagTag: SeaSched.TagAffinityMapMap
    isComprehensive: boolean
    permutationThreshold: number
    overallGradeThreshold: number
    resultThreshold: number
}

export interface OutboundProgressData {
    value: number
}

export interface OutboundResultData {
    schedules: SeaSched.Schedule[]
}

export interface OutboundMessage {
    type: 'progress'|'results'
    data: OutboundProgressData|OutboundResultData
}

onmessage = function (ev) {
    const message: InboundMessage = JSON.parse(ev.data)

    const schedules = [] as SeaSched.Schedule[]
    const scheduleHashes = [] as string[]
    for (let i = 0; i < message.permutationThreshold; i++) {
        const seed = message.seed + i
        const schedule = util.newSchedule(message.events)
        const generationSlots = util.newGenerationSlots(schedule.events)

        // Comprehensive generation method
        if (message.isComprehensive) {
            const digits = util.getBase10toBaseX(seed, message.workers.length + 1, generationSlots.length)
            for (let j = 0; j < digits.length; j++) {
                const digit = digits[j] as number
                const gs = generationSlots[j]

                // If our generation slot is somehow invalid, skip this cycle
                if (gs === undefined) {
                    continue
                }

                // If the assigned worker is 0, use that value directly instead
                // of trying to look up a real worker ID, since 0 = no worker
                if (digit === 0) {
                    gs.slot.workerId = 0
                    continue
                }

                // Otherwise, we're trying to assign a worker based on the digit
                // index value. If this worker isn't valid for the slot though,
                // we mark it as unassigned so we don't generate a bad schedule.
                const workerId = message.workers[digit - 1]?.id
                if (workerId === undefined) {
                    gs.slot.workerId = 0
                    continue
                }

                const validWorkers = util.getEligibleWorkersForSlot(gs, message.workers, message.affinitiesByTagTag)
                    .map((ew) => ew.workerId)
                if (!validWorkers.includes(workerId)) {
                    gs.slot.workerId = 0
                    continue
                }

                gs.slot.workerId = workerId
            }
        }
        // Best-effort generation method
        else {
            // Prep a list of worker assignment counts to help with balance
            const slotCountsByWorker = [{
                workerId: 0,
                count: 0
            }]
            for (const worker of message.workers) {
                slotCountsByWorker.push({
                    workerId: worker.id,
                    count: 0
                })
            }

            // Process required slots first, then optional
            const sets = [
                generationSlots.filter((gs) => gs.slot.isRequired === true),
                generationSlots.filter((gs) => gs.slot.isRequired === false)
            ]
            for (const set of sets) {
                // Use our generation seed to determine which slot to start with
                for (let j = 0; j < seed % generationSlots.length; j++) {
                    const last = set.pop()
                    if (last) {
                        set.unshift(last)
                    }
                }

                for (let j = 0; j< set.length; j++) {
                    const gs = set[j] as util.GenerationSlot

                    // If this slot already had an assignment in the base schedule,
                    // keep it and move on
                    if (gs.slot.workerId !== undefined) {
                        continue
                    }

                    let assignedWorkerId: number|undefined = undefined
                    let assignedAffinity: SeaSched.AssignmentAffinity|undefined = undefined
                    const eligible = util.getEligibleWorkersForSlot(gs, message.workers, message.affinitiesByTagTag)
                    if (eligible.length > 0) {
                        // Determine the lowest assignment count and any workers
                        // currently at that count
                        const lowestCount = slotCountsByWorker
                            .filter((sc) => sc.workerId !== 0)
                            .reduce((min, cur) => (cur.count < min) ? cur.count : min, 999999)
                        const lowCountWorkerIds = slotCountsByWorker
                            .filter((sc) => sc.count === lowestCount)
                            .map((sc) => sc.workerId)

                        // Try to assign to one of our low-count workers
                        const lowCountWorkerMatches = [] as number[]
                        for (const id of lowCountWorkerIds) {
                            if (eligible.map((e) => e.workerId).includes(id)) {
                                lowCountWorkerMatches.push(id)
                            }
                        }
                        if (lowCountWorkerMatches.length > 0) {
                            assignedWorkerId = lowCountWorkerMatches[(seed + j) % lowCountWorkerMatches.length]
                        }

                        // Otherwise, pick one of our available workers
                        if (assignedWorkerId === undefined) {
                            assignedWorkerId = eligible[(seed + j) % eligible.length]?.workerId
                        }

                        // Store the calculated affinity no matter what
                        assignedAffinity = eligible.find((e) => e.workerId === assignedWorkerId)?.affinity
                    } else {
                        assignedWorkerId = 0
                    }

                    // Finalize the assignment
                    gs.slot.workerId = assignedWorkerId
                    gs.slot.affinity = assignedAffinity
                    const sc = slotCountsByWorker.find((sc) => sc.workerId === assignedWorkerId)
                    if (sc) {
                        sc.count++
                    }
                }
            }
        }

        // Qualify the schedule before including it
        let shouldKeepResult = true

        // If a previous iteration has produced the same schedule, don't keep
        // it again
        const hash = util.getScheduleHash(schedule)
        if (scheduleHashes.includes(hash)) {
            shouldKeepResult = false
        }

        // Grade and further qualify the schedule
        schedule.grade = util.getScheduleGrade(schedule)
        if (schedule.grade.overall < message.overallGradeThreshold) {
            shouldKeepResult = false
        }

        // Add the schedule to our result list if we still want to keep it
        if (shouldKeepResult) {
            schedules.push(schedule)
            scheduleHashes.push(hash)
        }

        // Stop generating if we've reached our qualified result limit
        if (schedules.length >= message.resultThreshold) {
            break
        }

        // Don't report progress for each cycle, but if we've hit a certain
        // threshold, send an update on where we're at
        const reportingThreshold = 100
        if (i % reportingThreshold === 0) {
            const progress: OutboundMessage = {
                type: 'progress',
                data: {
                    value: reportingThreshold
                }
            }
            this.postMessage(progress)
        }
    }

    // Send the final results back to the caller
    const response: OutboundMessage = {
        type: 'results',
        data: {
            schedules
        }
    }
    this.postMessage(response)
}
