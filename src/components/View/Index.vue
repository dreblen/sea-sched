<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'

import type { DisplaySchedule, DisplayScheduleEvent, MinifiedDisplaySchedule } from '@/types'

import * as util from '@/util'

import NameHighlighter from '../NameHighlighter.vue'

const sharingKeyManualEntry = ref('')

const route = useRoute()

const sharingKeyInput = computed(() => typeof route.params.base64 === 'string' ? atob(route.params.base64) : '')

// Determine whether we have a minified schedule directly or if we were given
// a URL to access the schedule
const isLoading = ref(false)
const sharingKeyAsJson = computed(async () => {
    // Treat the input as a URL if it begins with HTTP
    const lower = sharingKeyInput.value.toLowerCase()
    if (lower.startsWith('http')) {
        isLoading.value = true
        let url = sharingKeyInput.value

        // If this is a link for a service we recognize, adjust it so we can
        // download the file instead of loading a preview page
        // - Google Drive
        if (lower.includes('://drive.google.com')) {
            // We only need to convert if this is a viewing link and not a
            // downloading link
            if (lower.includes('/view') && !lower.includes('export=download')) {
                const patternMatches = url.match(/file\/d\/([^/]+)/)
                if (patternMatches && patternMatches.length > 1) {
                    const fileId = patternMatches[1]
                    url = `https://drive.google.com/uc?export=download&id=${fileId}`
                }
            }
        }

        // Try to download the file outright
        try {
            const res = await fetch(url)
            const base64 = await res.text()
            const text = atob(base64)
            const json: Object = JSON.parse(text)
            return json
        } catch (e) {
            // Before giving up completely, try downloading via a CORS proxy
            // https://github.com/reynaldichernando/Whatever-Origin
            url = `https://whateverorigin.org/get?url=${encodeURIComponent(url)}`
            try {
                const res = await fetch(url)
                const resJson = await res.json()
                if (resJson.status.http_code === 200) {
                    const base64 = resJson.contents
                    const text = atob(base64)
                    const json: Object = JSON.parse(text)
                    return json
                }
            } catch (e) {
                return undefined
            } finally {
                isLoading.value = false
            }
        } finally {
            isLoading.value = false
        }
    }
    // Otherwise, see if we can parse it as JSON, and give a final fallback
    else {
        try {
            const json: Object = JSON.parse(sharingKeyInput.value)
            return json
        } catch (e) {
            return undefined
        }
    }
})

const display = ref<DisplaySchedule>({ events: [] })
watchEffect(async () => {
    const value = await sharingKeyAsJson.value
    if (value !== undefined) {
        display.value = util.getDisplayScheduleFromMinifiedDisplaySchedule(value as MinifiedDisplaySchedule)
    } else {
        display.value = {
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
        <template v-else-if="isLoading">
            <v-row justify="center">
                <v-col class="flex-grow-0 flex-shrink-1">
                    <v-progress-circular
                        indeterminate
                        size="150"
                        width="10"
                    >
                        Loading...
                    </v-progress-circular>
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
