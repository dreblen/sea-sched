<script setup lang="ts">
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
</script>

<template>
    <list-to-detail :items="results.schedules" :no-actions="true">
        <template #default="{ item: schedule }">
            <template v-if="!schedule">
                No schedule currently selected.
            </template>
            <template v-else>
                <p>Overall Grade: {{ (schedule as Schedule).grade?.overall }}</p>
                <p v-for="component of (schedule as Schedule).grade?.components" :key="component.name">
                    Component "{{ component.name }}" (Weight = {{ component.weight }}): {{ component.value }}
                </p>
                <table>
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th v-for="shift in (schedule as Schedule).events[0]?.shifts" :key="shift.id">
                                {{ shift.name }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="event in (schedule as Schedule).events" :key="event.id">
                            <td>{{ event.name }}</td>
                            <td v-for="shift in event.shifts" :key="shift.id">
                                <p v-for="slot in shift.slots" :key="slot.id">
                                    {{ slot.name }}: {{ setup.workers.find((w) => w.id === slot.workerId)?.name || 'N/A' }}
                                </p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </template>
        </template>
        <template #append="{ item }">
            <v-chip :color="getColorForGrade((item as Schedule).grade?.overall)">
                {{ (item as Schedule).grade?.overall }}
            </v-chip>
        </template>
    </list-to-detail>
</template>
