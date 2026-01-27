<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { VCalendar } from 'vuetify/components'

import { useParametersStore } from '@/stores/parameters'

const emit = defineEmits({
    complete() { return true },
    incomplete() { return true }
})

const parameters = useParametersStore()

const parametersImportJson = ref('')
const isParametersImportJsonValid = computed(() => {
    if (parametersImportJson.value.length === 0) {
        return false
    }

    try {
        JSON.parse(parametersImportJson.value)
        return true
    } catch (e) {
        return false
    }
})
function onImportParameters() {
    parameters.deserialize(parametersImportJson.value)
    restoreScopeRange()
}

const calendar = useTemplateRef<VCalendar>('calendar')
const currentDate = ref(new Date())
const events = ref([] as CalendarEvent[])

// Restore our previously selected range if we have one. We do this immediately
// on component mount, but we also have it in a function so it can happen if the
// user imports parameters.
function restoreScopeRange() {
    if (parameters.scope.dateStart > '1900-01-01') {
        events.value.push({
            name: 'Selected Range',
            start: parameters.scope.dateStart,
            end: parameters.scope.dateEnd
        })

        emit('complete')
    }
}
restoreScopeRange()

const clickCounter = ref(1)
function onDateClick(ev: Event, data: { date: string }) {
    // No matter what, we'll need access to our event object for tracking
    if (events.value.length === 0) {
        events.value.push({
            name: 'Test',
            start: '1900-01-01',
            end: '1900-01-01'
        })
    }
    const event = events.value[0] as CalendarEvent

    // If this is our first click in the sequence, we want to reset the event to
    // match the selected date
    if (clickCounter.value === 1) {
        event.name = 'Start...'
        event.start = data.date
        event.end = data.date

        clickCounter.value = 2

        // Invalidate our scope since we've started modifying its range
        parameters.resetScope()
        emit('incomplete')
    }
    // If it's the second click, we're setting the second date in the sequence
    else {
        event.name = 'Selected Range'
        // If the second date was before the first, swap them so they're
        // logically correct
        const currentStartDate = event.start
        if (data.date < currentStartDate) {
            event.start = data.date
            event.end = currentStartDate
        } else {
            event.end = data.date
        }

        clickCounter.value = 1

        // Store this selection as our new scope range
        parameters.scope.dateStart = event.start
        parameters.scope.dateEnd = event.end
        emit('complete')
    }
}
</script>

<template>
    <v-row>
        <v-col class="pb-0" cols="12" sm="8" md="9">
            If you've exported previous parameters, you can import them now
            rather than going through each step again.
        </v-col>
        <v-col cols="12" sm="4" md="3">
            <v-dialog max-width="500px">
                <template #activator="{ props }">
                    <v-btn v-bind="props">
                        Import...
                    </v-btn>
                </template>
                <template #default="{ isActive }">
                    <v-card>
                        <v-card-text>
                            <v-textarea
                                v-model="parametersImportJson"
                                label="Paste in parameters that you have exported previously"
                            />
                        </v-card-text>
                        <v-card-actions>
                            <v-btn @click="isActive.value = false">Cancel</v-btn>
                            <v-btn
                                color="warning"
                                @click="onImportParameters(); isActive.value = false"
                                :disabled="!isParametersImportJsonValid"
                            >
                                Import
                            </v-btn>
                        </v-card-actions>
                    </v-card>
                </template>
            </v-dialog>
        </v-col>
    </v-row>
    <v-row justify="center">
        <v-col class="flex-shrink-1 flex-grow-0">
            <v-btn icon variant="text" @click="calendar?.prev()">
                <v-icon>mdi-chevron-left</v-icon>
            </v-btn>
        </v-col>
        <v-col class="flex-shrink-1 flex-grow-0 text-h5">
            {{ calendar?.title.replace(' ','&nbsp;') }}
        </v-col>
        <v-col class="flex-shrink-1 flex-grow-0">
            <v-btn icon variant="text" @click="calendar?.next()">
                <v-icon>mdi-chevron-right</v-icon>
            </v-btn>
        </v-col>
    </v-row>
    <v-sheet height="600">
        <v-calendar
            v-model="currentDate"
            ref="calendar"
            type="month"
            :events="events"
            @click:date="onDateClick"
        />
    </v-sheet>
</template>
