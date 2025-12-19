<script setup lang="ts">
import type { Event, Shift } from '@/types'
import { useSetupStore } from '@/stores/setup'

import ListToDetail from '../ListToDetail.vue'
import TagSelect from '../TagSelect.vue'

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
                    <list-to-detail :items="(event.item as Event).shifts" v-slot="shift" vertical @add="setup.addEventShift(event.item.id)">
                        <!-- Vertical-oriented list-to-detail for shifts related to this event -->
                         <template v-if="!shift.item">
                            No shift currently selected.
                         </template>
                         <template v-else>
                            <v-row>
                                <v-col>
                                    <v-text-field label="Name" v-model="shift.item.name"></v-text-field>
                                </v-col>
                            </v-row>
                            <v-row>
                                <v-col>
                                    <list-to-detail :items="(shift.item as Shift).slots" v-slot="slot" vertical>
                                        <!-- Vertical-oriented list for slots relates to this shift -->
                                         <template v-if="!slot.item">
                                            No slot currently selected.
                                         </template>
                                         <template v-else>
                                            <v-row>
                                                <v-col>
                                                    <!-- Controls to edit/save basic details about slot -->
                                                     {{ slot.item.name }}
                                                </v-col>
                                            </v-row>
                                         </template>
                                    </list-to-detail>
                                </v-col>
                            </v-row>
                         </template>
                    </list-to-detail>
                </v-col>
            </v-row>
        </template>
    </list-to-detail>
</template>
