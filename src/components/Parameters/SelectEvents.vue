<script setup lang="ts">
import { computed, watchEffect } from 'vue'

import { useSetupStore } from '@/stores/setup'
import { useParametersStore } from '@/stores/parameters'

const emit = defineEmits({
    complete() { return true },
    incomplete() { return true }
})

const setup = useSetupStore()
const parameters = useParametersStore()

const sortedEvents = computed(() => {
    const e = setup.events.slice()
    return e.sort((a, b) => {
        if (a.name < b.name) {
            return -1
        }
        if (a.name > b.name) {
            return 1
        }
        return 0
    })
})

// If there are no selections when the component loads (i.e., first entry, or
// navigation back after manually deselecting everything), prepopulate with all
// valid options. This works because the user can't advance to the next step
// while this list is empty.
if (parameters.templateEventIds.length === 0) {
    parameters.templateEventIds = setup.events
        // We can only use events with a recurrence pattern
        .filter((e) => e.recurrences.length > 0)
        // We store only the ID for simplicity
        .map((e) => e.id)
}

watchEffect(() => {
    if (parameters.templateEventIds.length > 0) {
        emit('complete')
    } else {
        emit('incomplete')
    }
})
</script>

<template>
    <v-row>
        <v-col>
            <p>
                If an event is defined without any recurrence pattern, it will
                appear here as disabled. To be included in a schedule, an event
                must have at least one pattern.
            </p>
        </v-col>
    </v-row>
    <v-row>
        <v-col v-for="event of sortedEvents" :key="event.id" class="flex-shrink-1 flex-grow-0">
            <v-switch
                v-model="parameters.templateEventIds"
                :value="event.id"
                :label="event.name"
                :disabled="event.recurrences.length === 0"
                hide-details
                color="primary"
                style="display: block"
            >
                <template #label="{ label }">
                    <span style="text-wrap-mode: nowrap">{{ label }}</span>
                </template>
            </v-switch>
        </v-col>
    </v-row>
</template>
