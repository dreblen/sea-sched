<script setup lang="ts">
import { ref, nextTick, watchEffect, onBeforeUnmount, computed } from 'vue'

import type * as SeaSched from '@/types'

import { useSetupStore } from '@/stores/setup'
import { useParametersStore } from '@/stores/parameters'
import { useResultsStore } from '@/stores/results'

import * as util from '@/util'

import GenerationWorker from '@/generation-worker?worker'
import type { InboundMessage, OutboundMessage, OutboundProgressData, OutboundResultData } from '@/generation-worker'

const emit = defineEmits({
    complete() { return true },
    incomplete() { return true }
})

const setup = useSetupStore()
const parameters = useParametersStore()
const results = useResultsStore()

// Create a disconnected list of our scope events with any missing shifts/slots
// excluded. This doesn't need to be reactive, because it can't change here, and
// it will be recreated each time this component loads.
let eligibleEvents = [] as SeaSched.ScopeEvent[]
for (const event of parameters.scope.events) {
    if (event.shifts.length === 0) {
        continue
    }

    const newEvent: SeaSched.ScopeEvent = {
        id: event.id,
        name: event.name,
        tags: event.tags.slice(),
        shifts: [],
        calendarDate: event.calendarDate
    }

    for (const shift of event.shifts) {
        if (shift.slots.length === 0) {
            continue
        }

        const newShift: SeaSched.ScopeShift = {
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
                groupId: slot.groupId,
                isRequired: slot.isRequired
            })
        }

        newEvent.shifts.push(newShift)
    }

    if (newEvent.shifts.length > 0) {
        eligibleEvents.push(newEvent)
    }
}

// We only want to consider active workers, so get that list for reference
const activeWorkers = setup.workers.filter((w) => w.isActive)

// Store some simple summary statistics for display before generation
const numEvents = eligibleEvents.length
const numShifts = eligibleEvents.reduce((acc, e) => acc + e.shifts.length,0)
const numSlots = eligibleEvents.reduce((acc,e) => acc + e.shifts.reduce((acc, s) => acc + s.slots.length,0),0)
const numWorkers = activeWorkers.length
const numPermutations = Math.pow(numWorkers + 1, numSlots)

// Basic generation controls
const isStopShort = ref(true)
const isComprehensive = ref(false)
const permutationThreshold = ref(1000000)
const overallGradeThreshold = ref(90)
const resultThreshold = ref(25)

const isComprehensiveAllowed = computed(() => permutationThreshold.value >= numPermutations)
const isComprehensiveForMessage = computed(() => isComprehensiveAllowed.value && isComprehensive.value)
const isStopShortForMessage = computed(() => isStopShort.value && !isComprehensive.value)
const permutationThresholdForMessage = computed(() => Math.min(permutationThreshold.value, numPermutations))

const isGenerating = ref(false)
const generationProgress = ref(0)
const isCancelling = ref(false)
const threadDisposeMethods = ref<{(): void}[]>([])

async function generate() {
    // Reset our status indicators
    isGenerating.value = true
    generationProgress.value = 0
    isCancelling.value = false
    threadDisposeMethods.value = []
    await nextTick()

    // Clear out any previous results
    results.clearSchedules()
    results.setScopeSegments(parameters.scope.weeks, parameters.scope.months)
    results.setGradeComponents(setup.gradeComponents)

    // Establish a base of required worker assignments that can be a starting
    // point for every schedule attempt
    const baseSchedule = util.newSchedule(eligibleEvents)
    const baseGenerationSlots = util.newGenerationSlots(baseSchedule.events)
    for (const slot of baseGenerationSlots) {
        let eligible = util.getEligibleWorkersForSlot(slot, baseSchedule, activeWorkers, setup.affinitiesByTagTag)
        if (eligible.length === 1) {
            slot.slot.workerId = eligible[0]?.workerId
            slot.slot.affinity = eligible[0]?.affinity
        }
        if (eligible.length === 0) {
            slot.slot.workerId = 0
        }
    }

    // Generate schedules via worker threads
    const numThreads = navigator.hardwareConcurrency || 1
    let completedThreads = 0
    for (let i = 0; i < numThreads; i++) {
        const w = new GenerationWorker()

        const dispose = function () {
            w.terminate()
        }
        threadDisposeMethods.value.push(dispose)

        const finish = function () {
            // Sort our results to show higher grades first
            results.schedules.sort((a, b) => {
                if (a.grade?.overall !== undefined && b.grade?.overall === undefined) {
                    return -1
                }
                if (a.grade?.overall === undefined && b.grade?.overall !== undefined) {
                    return 1
                }
                if (a.grade?.overall === undefined && b.grade?.overall === undefined) {
                    return 0
                }
                if ((a.grade?.overall as number) > (b.grade?.overall as number)) {
                    return -1
                }
                if ((a.grade?.overall as number) < (b.grade?.overall as number)) {
                    return 1
                }
                return 0
            })

            isGenerating.value = false
        }

        w.onmessage = (m) => {
            const message: OutboundMessage = m.data
            switch (message.type) {
                case 'progress': {
                    const data = message.data as OutboundProgressData
                    generationProgress.value += data.value
                    break
                }
                case 'results': {
                    const data = message.data as OutboundResultData
                    for (const s of data.schedules) {
                        // Results are deduplicated within the generation
                        // worker, but we make this check in case the same
                        // result is produced by different threads
                        const hash = util.getScheduleHash(s)
                        if (!results.scheduleHashes.includes(hash)) {
                            results.addSchedule(s)
                        }
                    }
                    completedThreads++
                    if (completedThreads === numThreads) {
                        finish()
                    }
                    setTimeout(dispose, 5000)
                    break
                }
            }
        }

        w.onerror = (err) => {
            completedThreads++
            if (completedThreads === numThreads) {
                finish()
            }
            setTimeout(dispose, 5000)
        }

        const message: InboundMessage = {
            seed: Math.ceil(permutationThresholdForMessage.value / numThreads) * i,
            events: baseSchedule.events,
            workers: activeWorkers,
            tagAffinities: setup.tagAffinities,
            affinitiesByTagTag: setup.affinitiesByTagTag,
            gradeComponents: setup.gradeComponents,
            isStopShort: isStopShortForMessage.value,
            isComprehensive: isComprehensiveForMessage.value,
            permutationThreshold: Math.ceil(permutationThresholdForMessage.value / numThreads),
            overallGradeThreshold: overallGradeThreshold.value,
            resultThreshold: resultThreshold.value
        }
        w.postMessage(JSON.stringify(message))
    }
}

function cancel() {
    isCancelling.value = true

    for (const dispose of threadDisposeMethods.value) {
        dispose()
    }

    isGenerating.value = false
    isCancelling.value = false
}

onBeforeUnmount(() => {
    if (isGenerating.value === true && isCancelling.value === false) {
        cancel()
    }
})

watchEffect(() => {
    if (isGenerating.value === false && results.schedules.length > 0) {
        emit('complete')
    } else {
        emit('incomplete')
    }
})
</script>

<template>
    <v-row>
        <v-col>
            Events: {{ numEvents }}
        </v-col>
        <v-col>
            Shifts: {{ numShifts }}
        </v-col>
        <v-col>
            Slots: {{ numSlots }}
        </v-col>
        <v-col>
            Workers: {{ numWorkers }}
        </v-col>
        <v-col>
            Possible Permutations: {{ numPermutations }}
        </v-col>
    </v-row>
    <v-row>
        <v-col>
            <v-number-input
                v-model="permutationThreshold"
                label="Maximum Generation Attempts"
                :min="1"
            />
        </v-col>
        <v-col>
            <v-switch
                v-model="isStopShort"
                :disabled="isComprehensiveForMessage"
                color="primary"
                hint="If yes, stop generating schedules after reaching the target amount at the target grade, even if not the highest possible grade"
                persistent-hint
            >
                <template #label>
                    Stop Short: {{ isStopShort ? 'Yes' : 'No' }}
                </template>
            </v-switch>
        </v-col>
        <v-col>
            <v-switch
                v-model="isComprehensive"
                :disabled="!isComprehensiveAllowed"
                color="primary"
                hint="Comprehensive generation method only possible when max generation attempts >= total possible permutations"
                persistent-hint
            >
                <template #label>
                    <template v-if="isComprehensive">
                        Comprehensive
                    </template>
                    <template v-else>
                        Best Effort
                    </template>
                </template>
            </v-switch>
        </v-col>
        <v-col>
            <v-number-input
                v-model="overallGradeThreshold"
                label="Minimum Schedule Grade"
                :min="0"
                :max="100"
            />
        </v-col>
        <v-col>
            <v-number-input
                v-model="resultThreshold"
                label="Maximum Schedules"
                :min="1"
            />
        </v-col>
    </v-row>
    <v-row justify="center">
        <v-col class="flex-grow-0 flex-shrink-1">
            <v-btn color="success" @click="generate" :disabled="isGenerating" :loading="isGenerating">
                Start Generation Process
                <template #loader>
                    <v-progress-linear
                        v-model="generationProgress"
                        :max="permutationThresholdForMessage"
                    />
                </template>
            </v-btn>
        </v-col>
    </v-row>
    <v-row v-if="isGenerating" justify="center">
        <v-col class="flex-grow-0 flex-shrink-1">
            <v-btn
                color="error"
                @click="cancel"
                :disabled="isCancelling"
                :loading="isCancelling"
            >
                Cancel Generation
            </v-btn>
        </v-col>
    </v-row>
</template>
