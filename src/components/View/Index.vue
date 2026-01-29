<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import type { DisplaySchedule, DisplayScheduleEvent, MinifiedDisplaySchedule } from '@/types'

import * as util from '@/util'

import NameHighlighter from '../NameHighlighter.vue'

const sharingKeyManualEntry = ref('')

const route = useRoute()

const minified = computed(() => typeof route.params.base64 === 'string' ? atob(route.params.base64) : '')
const display = computed(() => {
    try {
        const m: MinifiedDisplaySchedule = JSON.parse(minified.value)
        return util.getDisplayScheduleFromMinifiedDisplaySchedule(m)
    } catch (e) {
        return {
            events: [],
        } as DisplaySchedule
    }
})

const uniqueShiftNames = computed(() => {
    const names = [] as string[]
    
    for (const event of display.value.events) {
        for (const shift of event.shifts) {
            if (!names.includes(shift.name)) {
                names.push(shift.name)
            }
        }
    }

    return names
})

interface MonthEvents {
    name: string
    yearMonth: string
    events: DisplayScheduleEvent[]
}
const eventsByMonth = computed(() => {
    const sets = [] as MonthEvents[]

    for (const event of display.value.events) {
        let match = sets.find((me) => me.yearMonth === event.calendarDate.substring(0,7))
        if (match === undefined) {
            match = {
                name: `${util.getNormalizedDate(event.calendarDate).toLocaleString('default', { month: 'long' })} ${event.calendarDate.substring(0,4)}`,
                yearMonth: event.calendarDate.substring(0,7),
                events: [],
            }

            sets.push(match)
        }

        match.events.push(event)
    }

    return sets
})
</script>

<template>
    <v-container class="fill-height">
        <template v-if="!route.params.base64">
            <v-row align="center">
                <v-col cols="12">
                    <v-row justify="center">
                        <v-col cols="12" sm="8">
                            You can use this page to look at a schedule that has been
                            generated using this tool. If you have a sharing key, you
                            can paste it below:
                        </v-col>
                        <v-col cols="12" sm="8">
                            <v-text-field
                                v-model="sharingKeyManualEntry"
                                label="Sharing Key"
                            />
                        </v-col>
                    </v-row>
                    <v-row justify="center">
                        <v-col class="flex-grow-0 flex-shrink-1">
                            <v-btn
                                :disabled="sharingKeyManualEntry.length === 0"
                                :to="`/view/${sharingKeyManualEntry}`"
                                color="primary"
                            >
                                View Schedule
                            </v-btn>
                        </v-col>
                    </v-row>
                </v-col>
            </v-row>
        </template>
        <template v-else-if="display.events.length === 0">
            <v-row justify="center">
                <v-col>
                    <p class="text-center">
                        There are no events to display in the schedule provided.
                    </p>
                </v-col>
            </v-row>
        </template>
        <template v-else>
            <v-row v-for="month in eventsByMonth">
                <v-col>
                    <v-table striped="even">
                        <thead>
                            <tr>
                                <th :colspan="1 + uniqueShiftNames.length" class="text-h4 text-center">
                                    {{ month.name }}
                                </th>
                            </tr>
                            <tr>
                                <th>Event</th>
                                <th v-for="name in uniqueShiftNames" :key="name">
                                    {{ name }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="event in month.events">
                                <td>
                                    {{ event.name }}
                                </td>
                                <td v-for="shiftName in uniqueShiftNames">
                                    <template v-for="shift in event.shifts.filter((s) => s.name === shiftName)">
                                        <div v-for="group in shift.slotGroups">
                                            <p v-for="slot in group.slots">
                                                {{ slot.name }}:
                                                <name-highlighter
                                                    :highlight-class-name="`worker-${slot.workerName}`"
                                                    highlight-color="#ff0"
                                                >
                                                    {{ slot.workerName }}
                                                </name-highlighter>
                                            </p>
                                        </div>
                                    </template>
                                </td>
                            </tr>
                        </tbody>
                    </v-table>
                </v-col>
            </v-row>
        </template>
    </v-container>
</template>
