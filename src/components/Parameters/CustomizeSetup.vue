<script setup lang="ts">
import { ref } from 'vue'
import type { ScopeEvent } from '@/types'
import { useParametersStore } from '@/stores/parameters'
import * as util from '@/util'

import EventListToDetail from '../EventListToDetail.vue'
import { watchEffect } from 'vue'

const emit = defineEmits({
    complete() { return true },
    incomplete() { return true }
})

const parameters = useParametersStore()

// If we have no segments defined in our scope, we need to initialize
if (parameters.scope.weeks.length === 0) {
    parameters.generateScope()
}

watchEffect(() => {
    if (parameters.scope.events.length > 0) {
        emit('complete')
    } else {
        emit('incomplete')
    }
})

const showEventCalendarDateSelector = ref(false)
const eventCalendarDateBuffer = ref(new Date())

function onEventListChange(eventId?: number, eventName?: string) {
    if (eventId === undefined) {
        return
    }

    const event = parameters.scope.events.find((e) => e.id === eventId)
    if (event === undefined) {
        return
    }

    eventCalendarDateBuffer.value = util.getNormalizedDate(event.calendarDate)
}
</script>

<template>
    <v-row>
        <v-col>
            <v-dialog max-width="500px" persistent>
                <template #activator="{ props }">
                    <v-btn v-bind="props" color="error">Reset to Current Selection</v-btn>
                </template>
                <template #default="{ isActive }">
                    <v-card>
                        <v-card-text>
                            If you reset, the currently selected events from the
                            previous step will overwrite any customizations you
                            have made in this step. Do you want to reset?
                        </v-card-text>
                        <v-card-actions>
                            <v-btn @click="isActive.value = false">No</v-btn>
                            <v-btn color="error" @click="parameters.generateScope(); isActive.value = false">Yes</v-btn>
                        </v-card-actions>
                    </v-card>
                </template>
            </v-dialog>
        </v-col>
    </v-row>
    <v-row style="max-height: 100%; overflow-y: scroll;">
        <event-list-to-detail
            :items="parameters.scope.events"
            :store="parameters"
            @change-events="onEventListChange"
        >
            <template #eventProps="{ item: event }">
                <v-col>
                    <v-menu
                        v-model="showEventCalendarDateSelector"
                        :close-on-content-click="false"
                    >
                        <template #activator="{ props }">
                            <v-text-field
                                v-bind="props"
                                v-model="(event as ScopeEvent).calendarDate"
                                label="Calendar Date"
                                prepend-inner-icon="mdi-calendar"
                                :readonly="true"
                                hide-details
                            />
                        </template>
                        <v-date-picker
                            v-model="eventCalendarDateBuffer"
                            show-adjacent-months
                            @update:model-value="(event as ScopeEvent).calendarDate = util.getDateString(eventCalendarDateBuffer)"
                            @input="showEventCalendarDateSelector = false"
                            :min="parameters.scope.dateStart"
                            :max="parameters.scope.dateEnd"
                        />
                    </v-menu>
                </v-col>
            </template>
        </event-list-to-detail>
    </v-row>
</template>
