<script setup lang="ts">
import type { Event, RecurrencePattern } from '@/types'
import { useSetupStore } from '@/stores/setup'

import ListToDetail from '../ListToDetail.vue'
import EventListToDetail from '../EventListToDetail.vue'
import RecurrencePatternDetail from '../RecurrencePatternDetail.vue'

const setup = useSetupStore()
</script>

<template>
    <event-list-to-detail :items="setup.events" :store="setup">
        <template #eventProps="{ item: event }">
            <v-col cols="12">
                <h1 class="text-h4">Recurrence Patterns</h1>
                <list-to-detail :items="(event as Event).recurrences" vertical @add="setup.addEventRecurrence(event.id)" @remove="(recurrenceId?: number) => { setup.removeEventRecurrence(event.id, recurrenceId) }">
                    <template #uncontained="recurrence">
                        <template v-if="!recurrence.item">
                            No recurrence pattern currently selected.
                        </template>
                        <template v-else>
                            <recurrence-pattern-detail v-model="(recurrence.item as RecurrencePattern)"></recurrence-pattern-detail>
                        </template>
                    </template>
                </list-to-detail>
            </v-col>
        </template>
    </event-list-to-detail>
</template>
