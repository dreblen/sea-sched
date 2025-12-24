<script setup lang="ts">
import type { GenericEvent, GenericShift, GenericSlot } from '@/types'
import type { EventManagementStore } from '@/util'

import ListToDetail from './ListToDetail.vue'
import TagSelect from './TagSelect.vue'

const props = defineProps<{
    items: GenericEvent[]
    store: EventManagementStore
}>()

defineEmits({
    changeEvents(id?: number, name?: string) { return true }
})
</script>

<template>
    <list-to-detail
        :items="items"
        v-slot="{ item: event }"
        @add="store.addEvent"
        @remove="store.removeEvent"
        @change="(id, name) => { $emit('changeEvents', id, name) }"
    >
        <template v-if="!event">
            No event currently selected.
        </template>
        <template v-else>
            <v-row>
                <v-col>
                    <v-text-field label="Name" v-model="event.name"></v-text-field>
                </v-col>
                <v-col>
                    <tag-select v-model="(event as GenericEvent).tags" />
                </v-col>
                <slot v-if="$slots.eventProps" name="eventProps" :item="event"></slot>
            </v-row>
            <v-row>
                <v-col>
                    <h1 class="text-h4">Shifts</h1>
                    <list-to-detail :items="(event as GenericEvent).shifts" vertical @add="store.addEventShift(event.id)" @remove="(shiftId?: number) => { store.removeEventShift(event.id, shiftId) }">
                        <template #uncontained="{ item: shift }">
                            <template v-if="!shift">
                                No shift currently selected.
                            </template>
                            <template v-else>
                                <v-row>
                                    <v-col>
                                        <v-text-field label="Name" v-model="shift.name"></v-text-field>
                                    </v-col>
                                    <v-col>
                                        <tag-select v-model="(shift as GenericShift).tags" />
                                    </v-col>
                                    <slot v-if="$slots.shiftProps" name="shiftProps" :item="shift"></slot>
                                </v-row>
                                <v-row>
                                    <v-col>
                                        <h1 class="text-h4">Slots</h1>
                                        <list-to-detail :items="(shift as GenericShift).slots" vertical @add="store.addShiftSlot(event.id, shift.id)" @remove="(slotId?: number) => { store.removeShiftSlot(event.id, shift.id, slotId) }">
                                            <template #uncontained="{ item: slot }">
                                                <template v-if="!slot">
                                                    No slot currently selected.
                                                </template>
                                                <template v-else>
                                                    <v-row>
                                                        <v-col>
                                                            <v-text-field label="Name" v-model="slot.name"></v-text-field>
                                                        </v-col>
                                                        <v-col>
                                                            <tag-select v-model="(slot as GenericSlot).tags" />
                                                        </v-col>
                                                        <v-col>
                                                            <v-switch
                                                                v-model="(slot as GenericSlot).isRequired"
                                                                :label="((slot as GenericSlot).isRequired) ? 'Required' : 'Optional'"
                                                                color="primary"
                                                            />
                                                        </v-col>
                                                        <slot v-if="$slots.slotProps" name="slotProps" :item="slot"></slot>
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
