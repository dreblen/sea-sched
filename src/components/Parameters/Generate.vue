<script setup lang="ts">
import { ref, nextTick, watchEffect } from 'vue'

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

watchEffect(() => {
    if (results.schedules.length > 0) {
        emit('complete')
    } else {
        emit('incomplete')
    }
})

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
                isRequired: slot.isRequired
            })
        }

        newEvent.shifts.push(newShift)
    }

    if (newEvent.shifts.length > 0) {
        eligibleEvents.push(newEvent)
    }
}

// Store some simple summary statistics for display before generation
const numEvents = eligibleEvents.length
const numShifts = eligibleEvents.reduce((acc, e) => acc + e.shifts.length,0)
const numSlots = eligibleEvents.reduce((acc,e) => acc + e.shifts.reduce((acc, s) => acc + s.slots.length,0),0)
const numWorkers = setup.workers.length
const numPermutations = Math.pow(numWorkers + 1, numSlots)

// TODO: If permutation threshold is <= total number of permutations, then
// follow a mathematically complete generation scheme instead of the usual
// prefiltered one.
const permutationThreshold = ref(1000000)
const overallGradeThreshold = ref(90)
const resultThreshold = ref(25)

const isGenerating = ref(false)
const generationProgress = ref(0)
async function generate() {
    isGenerating.value = true
    generationProgress.value = 0
    await nextTick()

    // Clear out any previous results
    results.clearSchedules()

    // Establish a base of required worker assignments that can be a starting
    // point for every schedule attempt
    const baseSchedule = util.newSchedule(eligibleEvents)
    const baseGenerationSlots = util.newGenerationSlots(baseSchedule.events)
    for (const slot of baseGenerationSlots) {
        let workers = util.getEligibleWorkersForSlot(slot, setup.workers, setup.affinitiesByTagTag)
        if (workers.length === 1) {
            slot.slot.workerId = workers[0]
        }
        if (workers.length === 0) {
            slot.slot.workerId = 0
        }
    }

    // Generate schedules via worker threads
    const numThreads = 2
    for (let i = 0; i < numThreads; i++) {
        const w = new GenerationWorker()
        const dispose = function () {
            w.terminate()
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
                        results.addSchedule(s)
                    }
                    isGenerating.value = false
                    setTimeout(dispose, 5000)
                    break
                }
            }
        }
        w.onerror = (err) => {
            isGenerating.value = false
            setTimeout(dispose, 5000)
        }

        const message: InboundMessage = {
            seed: (permutationThreshold.value / numThreads) * i,
            events: baseSchedule.events,
            workers: setup.workers,
            affinitiesByTagTag: setup.affinitiesByTagTag,
            permutationThreshold: permutationThreshold.value / numThreads,
            resultThreshold: resultThreshold.value
        }
        w.postMessage(JSON.stringify(message))
    }
}
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
                        :max="permutationThreshold"
                    />
                </template>
            </v-btn>
        </v-col>
    </v-row>
</template>
