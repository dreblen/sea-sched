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

function copyParametersStoreToClipboard() {
    navigator.clipboard.writeText(parameters.serialize())
}

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

// Basic generation controls, building off of what's found in the parameters
const isComprehensiveAllowed = computed(() => parameters.permutationThreshold >= numPermutations)
const isComprehensiveForMessage = computed(() => isComprehensiveAllowed.value && (parameters.isComprehensive || parameters.permutationThreshold >= numPermutations))
const isStopShortForMessage = computed(() => parameters.isStopShort && !parameters.isComprehensive)
const permutationThresholdForMessage = computed(() => Math.min(parameters.permutationThreshold, numPermutations))

const hasScopeHashChanged = computed(() => parameters.scopeHash !== results.scopeHash)
const useBaseScheduleForMessage = computed(() => parameters.useBaseSchedule && !hasScopeHashChanged.value)

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
    results.scopeHash = util.getScopeHash(parameters.scope, setup.tags)
    results.clearSchedules()
    results.setScopeSegments(parameters.scope.weeks, parameters.scope.months)
    results.setGradeComponents(setup.gradeComponents)
    results.setTags(setup.tags)

    // Establish a base of prefilled slot assignments that can be a starting
    // point for every schedule attempt:
    const baseSchedule = util.newSchedule(eligibleEvents)
    const baseGenerationSlots = util.newGenerationSlots(baseSchedule.events)

    // - From a previously generated schedule's selected steps
    if (useBaseScheduleForMessage.value && parameters.baseSchedule) {
        const gss = util.newGenerationSlots(parameters.baseSchedule.events)
        for (const gs of gss.filter((gs) => gs.slot.workerId !== undefined)) {
            const target = baseGenerationSlots.find((t) => t.event.id === gs.event.id && t.shift.id === gs.shift.id && t.slot.id === gs.slot.id)
            if (target === undefined) {
                continue
            }

            target.slot.workerId = gs.slot.workerId
            target.slot.affinity = gs.slot.affinity
            target.slot.affinityNotes = gs.slot.affinityNotes
        }

        // Clear out any stored base schedule now that it has been used
        parameters.baseSchedule = undefined
    }

    // - From de facto assignments by process of elimination
    for (const slot of baseGenerationSlots) {
        // Skip any slots handled by the previous logic
        if (slot.slot.workerId !== undefined) {
            continue
        }

        let eligible = util.getEligibleWorkersForSlot(slot, baseSchedule, activeWorkers, setup.affinitiesByTagTag)
        if (eligible.length === 1) {
            slot.slot.workerId = eligible[0]?.workerId
            slot.slot.affinity = eligible[0]?.affinity
            slot.slot.affinityNotes = eligible[0]?.affinityNotes
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

            // Trim our results down if running multiple threads put us over our
            // target amount
            if (results.schedules.length > parameters.resultThreshold) {
                results.schedules.splice(parameters.resultThreshold)
            }

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
                case 'result': {
                    const data = message.data as OutboundResultData
                    // Results are deduplicated within the generation worker,
                    // but we make this check in case the same result is
                    // produced by different threads
                    if (!results.scheduleHashes.includes(data.schedule.hash)) {
                        results.addSchedule(data.schedule)
                    }
                    break
                }
                case 'finish': {
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
            overallGradeThreshold: parameters.overallGradeThreshold,
            resultThreshold: parameters.resultThreshold
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
        <v-col class="pb-0" cols="12" md="8">
            If you want to preserve your parameters up to this point so you can
            come back to them later, export it now using this option:
        </v-col>
        <v-col cols="12" md="4">
            <v-btn
                @click="copyParametersStoreToClipboard"
                append-icon="mdi-content-copy"
            >
                Copy to Clipboard
            </v-btn>
        </v-col>
    </v-row>
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
                v-model="parameters.permutationThreshold"
                :disabled="isGenerating"
                label="Maximum Generation Attempts"
                :min="1"
            />
        </v-col>
        <v-col>
            <v-switch
                v-model="parameters.isStopShort"
                :disabled="isGenerating || parameters.isComprehensive"
                color="primary"
                hint="If yes, stop generating schedules after reaching the target amount at the target grade, even if not the highest possible grade"
                persistent-hint
            >
                <template #label>
                    Stop Short: {{ parameters.isStopShort ? 'Yes' : 'No' }}
                </template>
            </v-switch>
        </v-col>
        <v-col>
            <v-switch
                v-model="parameters.isComprehensive"
                :disabled="isGenerating || !isComprehensiveAllowed"
                color="primary"
                hint="Comprehensive generation method only possible when max generation attempts >= total possible permutations"
                persistent-hint
            >
                <template #label>
                    <template v-if="parameters.isComprehensive">
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
                v-model="parameters.overallGradeThreshold"
                :disabled="isGenerating"
                label="Minimum Schedule Grade"
                :min="0"
                :max="100"
            />
        </v-col>
        <v-col>
            <v-number-input
                v-model="parameters.resultThreshold"
                :disabled="isGenerating"
                label="Maximum Schedules"
                :min="1"
            />
        </v-col>
    </v-row>
    <v-row v-if="parameters.baseSchedule">
        <v-col>
            <v-checkbox
                v-model="parameters.useBaseSchedule"
                label="Use stored steps from the Results tab as a starting point for all schedules?"
                :disabled="isGenerating || hasScopeHashChanged"
                color="primary"
                hide-details
            />
            <span v-if="hasScopeHashChanged" class="text-caption">
                You cannot use the stored steps because the parameter events are
                not the same as they were when the steps were created. If you
                adjust the parameter events to match again, this option will be
                re-enabled.
            </span>
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
