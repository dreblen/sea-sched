<script setup lang="ts">
import type { Schedule } from '@/types'

import { useSetupStore } from '@/stores/setup'
import { useResultsStore } from '@/stores/results'

import ListToDetail from '../ListToDetail.vue'

const setup = useSetupStore()
const results = useResultsStore()
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
    </list-to-detail>
</template>
