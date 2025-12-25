import type * as SeaSched from '@/types'
import * as util from '@/util'

export interface InboundMessage {
    seed: number
    events: SeaSched.ScheduleEvent[]
    workers: SeaSched.Worker[]
    affinitiesByTagTag: SeaSched.TagAffinityMapMap
    permutationThreshold: number
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
    for (let i = 0; i < message.permutationThreshold; i++) {
        const seed = message.seed + i
        const schedule = util.newSchedule(message.events)
        const generationSlots = util.newGenerationSlots(schedule.events)

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

                let assignedWorkerId: number|undefined = undefined
                const workerIds = util.getEligibleWorkersForSlot(gs, message.workers, message.affinitiesByTagTag)
                if (workerIds.length > 0) {
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
                        if (workerIds.includes(id)) {
                            lowCountWorkerMatches.push(id)
                        }
                    }
                    if (lowCountWorkerMatches.length > 0) {
                        assignedWorkerId = lowCountWorkerMatches[(seed + j) % lowCountWorkerMatches.length]
                    }

                    // Otherwise, pick one of our available workers
                    if (assignedWorkerId === undefined) {
                        assignedWorkerId = workerIds[(seed + j) % workerIds.length]
                    }
                } else {
                    assignedWorkerId = 0
                }

                // Finalize the assignment
                gs.slot.workerId = assignedWorkerId
                const sc = slotCountsByWorker.find((sc) => sc.workerId === assignedWorkerId)
                if (sc) {
                    sc.count++
                }
            }
        }

        // TODO: Grade and qualify the schedule before adding to result list
        if (schedules.length < message.resultThreshold) {
            schedules.push(schedule)
        } else {
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
