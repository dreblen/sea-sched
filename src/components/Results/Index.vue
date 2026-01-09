<script setup lang="ts">
import { computed } from 'vue'

import type { Schedule } from '@/types'

import { useSetupStore } from '@/stores/setup'
import { useResultsStore } from '@/stores/results'

import ListToDetail from '../ListToDetail.vue'

const setup = useSetupStore()
const results = useResultsStore()

function getColorForGrade(gradeValue?: number) {
    if (gradeValue === undefined) {
        return
    } else if (gradeValue >= 90) {
        return 'success'
    } else if (gradeValue >= 70) {
        return 'warning'
    } else {
        return 'error'
    }
}

const uniqueShiftNames = computed(() => {
    const names = [] as string[]
    
    if (results.schedules.length > 0) {
        for (const event of (results.schedules[0] as Schedule).events) {
            for (const shift of event.shifts) {
                if (!names.includes(shift.name)) {
                    names.push(shift.name)
                }
            }
        }
    }

    return names
})
</script>

<template>
    <list-to-detail :items="results.schedules" :no-actions="true">
        <template #default="{ item: schedule }">
            <template v-if="!schedule">
                No schedule currently selected.
            </template>
            <template v-else>
                <v-container>
                    <v-row>
                        <v-col>
                            <v-expansion-panels>
                                <v-expansion-panel>
                                    <v-expansion-panel-title>
                                        <v-chip :color="getColorForGrade((schedule as Schedule).grade?.overall)">
                                            {{ (schedule as Schedule).grade?.overall }}
                                        </v-chip>
                                        Grade Details...
                                    </v-expansion-panel-title>
                                    <v-expansion-panel-text>
                                        <v-row v-for="component of (schedule as Schedule).grade?.components" :key="component.name">
                                            <v-col cols="4" sm="2" lg="1">
                                                <v-chip density="compact" :color="getColorForGrade(component.value)">
                                                    {{ component.value }}
                                                </v-chip>
                                            </v-col>
                                            <v-col>
                                                {{ component.name }} (Weight = {{ component.weight }}%)
                                            </v-col>
                                        </v-row>
                                    </v-expansion-panel-text>
                                </v-expansion-panel>
                            </v-expansion-panels>
                        </v-col>
                    </v-row>
                    <v-row>
                        <v-col>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Event</th>
                                        <th v-for="name in uniqueShiftNames" :key="name">
                                            {{ name }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="event in (schedule as Schedule).events" :key="event.id">
                                        <td>{{ event.name }}</td>
                                        <td v-for="name in uniqueShiftNames" :key="name">
                                            <p v-for="slot in event.shifts.find((s) => s.name === name)?.slots" :key="slot.id">
                                                {{ slot.name }}: {{ setup.workers.find((w) => w.id === slot.workerId)?.name || 'N/A' }}
                                            </p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </v-col>
                    </v-row>
                </v-container>
            </template>
        </template>
        <template #append="{ item }">
            <v-chip :color="getColorForGrade((item as Schedule).grade?.overall)">
                {{ (item as Schedule).grade?.overall }}
            </v-chip>
        </template>
    </list-to-detail>
</template>
