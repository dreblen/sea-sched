<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { VCalendar } from 'vuetify/components'

import { useParametersStore } from '@/stores/parameters'

const emit = defineEmits({
    complete() { return true },
    incomplete() { return true }
})

const parameters = useParametersStore()
const calendar = useTemplateRef<VCalendar>('calendar')
const currentDate = ref(new Date())
const events = ref([] as CalendarEvent[])

// Restore our previously selected range if we have one
if (parameters.scope.dateStart > '1900-01-01') {
    events.value.push({
        name: 'Selected Range',
        start: parameters.scope.dateStart,
        end: parameters.scope.dateEnd
    })

    emit('complete')
}

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
