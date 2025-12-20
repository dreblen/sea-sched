<script setup lang="ts">
import type { Event, Shift, Slot, RecurrencePattern } from '@/types'
import { useSetupStore } from '@/stores/setup'

import ListToDetail from '../ListToDetail.vue'
import TagSelect from '../TagSelect.vue'
import RecurrencePatternDetail from '../RecurrencePatternDetail.vue'

const setup = useSetupStore()
</script>

<template>
    <list-to-detail :items="setup.events" v-slot="event" @add="setup.addEvent" @remove="setup.removeEvent">
        <template v-if="!event.item">
            No event currently selected.
        </template>
        <template v-else>
            <v-row>
                <v-col>
                    <v-text-field label="Name" v-model="event.item.name"></v-text-field>
                </v-col>
                <v-col>
                    <tag-select v-model="(event.item as Event).tags" />
                </v-col>
            </v-row>
            <v-row>
                <v-col>
                    <h1 class="text-h4">Recurrence Patterns</h1>
                    <list-to-detail :items="(event.item as Event).recurrences" vertical @add="setup.addEventRecurrence(event.item.id)" @remove="(recurrenceId?: number) => { setup.removeEventRecurrence(event.item?.id, recurrenceId) }">
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
            </v-row>
            <v-row>
                <v-col>
                    <h1 class="text-h4">Shifts</h1>
                    <list-to-detail :items="(event.item as Event).shifts" vertical @add="setup.addEventShift(event.item.id)" @remove="(shiftId?: number) => { setup.removeEventShift(event.item?.id, shiftId) }">
                        <template #uncontained="shift">
                            <template v-if="!shift.item">
                                No shift currently selected.
                            </template>
                            <template v-else>
                                <v-row>
                                    <v-col>
                                        <v-text-field label="Name" v-model="shift.item.name"></v-text-field>
                                    </v-col>
                                    <v-col>
                                        <tag-select v-model="(shift.item as Shift).tags" />
                                    </v-col>
                                </v-row>
                                <v-row>
                                    <v-col>
                                        <h1 class="text-h4">Slots</h1>
                                        <list-to-detail :items="(shift.item as Shift).slots" vertical @add="setup.addShiftSlot(event.item.id, shift.item.id)" @remove="(slotId?: number) => { setup.removeShiftSlot(event.item?.id, shift.item?.id, slotId) }">
                                            <template #uncontained="slot">
                                                <template v-if="!slot.item">
                                                    No slot currently selected.
                                                </template>
                                                <template v-else>
                                                    <v-row>
                                                        <v-col>
                                                            <v-text-field label="Name" v-model="slot.item.name"></v-text-field>
                                                        </v-col>
                                                        <v-col>
                                                            <tag-select v-model="(slot.item as Slot).tags" />
                                                        </v-col>
                                                        <v-col>
                                                            <v-switch
                                                                v-model="(slot.item as Slot).isRequired"
                                                                :label="((slot.item as Slot).isRequired) ? 'Required' : 'Optional'"
                                                                color="primary"
                                                            />
                                                        </v-col>
                                                    </v-row>
                                                </template>
                                            </template>
                                        </list-to-detail>
                                    </v-col>
                                </v-row>
                            </template>
                        </template>
                    </list-to-detail>
                </v-col>
            </v-row>
        </template>
    </list-to-detail>
</template>
