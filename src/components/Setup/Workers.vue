<script setup lang="ts">
import type { Worker, AvailabilityDate } from '@/types'
import { ref } from 'vue'
import { useSetupStore } from '@/stores/setup'

import ListToDetail from '../ListToDetail.vue'
import TagSelect from '../TagSelect.vue'

const setup = useSetupStore()

// Controls and logic for unavailability date selections
const showDateStartSelector = ref(false)
const dateStartBuffer = ref(new Date())
const showDateEndSelector = ref(false)
const dateEndBuffer = ref(new Date())

function onDateListChange(unavailableDateId?: number, dateString?: string) {
    if (dateString === undefined) {
        return
    }

    // Split the front and back parts of the string
    const [ front, back ] = dateString.split(' to ')

    // Normalize both date values into local times so they don't offset
    let local = [] as Date[]
    for (const s of [front, back]) {
        const utc = new Date(s + 'T00:00:00Z')
        utc.setMinutes(utc.getMinutes() + utc.getTimezoneOffset())
        local.push(utc)
    }

    dateStartBuffer.value = local[0] as Date
    dateEndBuffer.value = local[1] as Date
}

function onDatePickerChange(unavailableDate: AvailabilityDate, type: 'start'|'end') {
    const buffer = (type === 'start') ? dateStartBuffer.value : dateEndBuffer.value
    const propName = (type === 'start') ? 'dateStart' : 'dateEnd'

    unavailableDate[propName] = (buffer.toISOString().split('T')[0] as string)
    unavailableDate.name = unavailableDate.dateStart + ' to ' + unavailableDate.dateEnd
}

const tagLogicOptions = [
    { title: 'Any', value: 'any' },
    { title: 'All', value: 'all' },
]
</script>

<template>
    <list-to-detail :items="setup.workers" v-slot="worker" @add="setup.addWorker" @remove="setup.removeWorker">
        <template v-if="!worker.item">
            No worker currently selected.
        </template>
        <template v-else>
            <v-row>
                <v-col>
                    <v-text-field label="Name" v-model="worker.item.name"></v-text-field>
                </v-col>
                <v-col>
                    <tag-select v-model="(worker.item as Worker).tags" />
                </v-col>
            </v-row>
            <v-row>
                <v-col cols="12">
                    <h1 class="text-h4">Assignment Limits</h1>
                </v-col>
                <v-col cols="12" sm="8" md="6" lg="4">
                    <v-number-input
                        v-model="(worker.item as Worker).weekLimit"
                        label="Per Week"
                        hint="0 = No Limit"
                        :min="0"
                    >
                        <template #append>
                            <v-switch
                                v-model="(worker.item as Worker).weekLimitRequired"
                                :label="(worker.item as Worker).weekLimitRequired ? 'Required' : 'Optional'"
                                color="primary"
                                hide-details
                            />
                        </template>
                    </v-number-input>
                </v-col>
                <v-col cols="12" sm="8" md="6" lg="4">
                    <v-number-input
                        v-model="(worker.item as Worker).monthLimit"
                        label="Per Month"
                        hint="0 = No Limit"
                        :min="0"
                    >
                        <template #append>
                            <v-switch
                                v-model="(worker.item as Worker).monthLimitRequired"
                                :label="(worker.item as Worker).monthLimitRequired ? 'Required' : 'Optional'"
                                color="primary"
                                hide-details
                            />
                        </template>
                    </v-number-input>
                </v-col>
            </v-row>
            <v-row>
                <v-col>
                    <h1 class="text-h4">Unavailability</h1>
                    <list-to-detail
                        :items="(worker.item as Worker).unavailableDates"
                        vertical
                        @add="setup.addWorkerUnvailableDate(worker.item.id)"
                        @remove="(unavailableDateId?: number) => { setup.removeWorkerUnavailableDate(worker.item?.id, unavailableDateId) }"
                        @change="onDateListChange"
                    >
                        <template #uncontained="unavailableDate">
                            <template v-if="!unavailableDate.item">
                                No date currently selected.
                            </template>
                            <template v-else>
                                <v-row>
                                    <v-col cols="6" sm="4">
                                        <v-menu
                                            v-model="showDateStartSelector"
                                            :close-on-content-click="false"
                                        >
                                            <template v-slot:activator="{ props }">
                                                <v-text-field
                                                    v-bind="props"
                                                    label="Range Start"
                                                    :model-value="(dateStartBuffer.toISOString().split('T')[0] as string)"
                                                    prepend-inner-icon="mdi-calendar"
                                                    :readonly="true"
                                                    hide-details
                                                />
                                            </template>
                                            <v-date-picker
                                                v-model="dateStartBuffer"
                                                show-adjacent-months
                                                @update:model-value="onDatePickerChange(unavailableDate.item as AvailabilityDate, 'start')"
                                                @input="showDateStartSelector = false"
                                                :max="(unavailableDate.item as AvailabilityDate).dateEnd"
                                            />
                                        </v-menu>
                                    </v-col>
                                    <v-col cols="6" sm="4">
                                        <v-menu
                                            v-model="showDateEndSelector"
                                            :close-on-content-click="false"
                                        >
                                            <template v-slot:activator="{ props }">
                                                <v-text-field
                                                    v-bind="props"
                                                    label="Range End"
                                                    :model-value="(dateEndBuffer.toISOString().split('T')[0] as string)"
                                                    prepend-inner-icon="mdi-calendar"
                                                    :readonly="true"
                                                    hide-details
                                                />
                                            </template>
                                            <v-date-picker
                                                v-model="dateEndBuffer"
                                                show-adjacent-months
                                                @update:model-value="onDatePickerChange(unavailableDate.item as AvailabilityDate, 'end')"
                                                @input="showDateEndSelector = false"
                                                :min="(unavailableDate.item as AvailabilityDate).dateStart"
                                            />
                                        </v-menu>
                                    </v-col>
                                    <v-col cols="12" sm="4">
                                        <v-select
                                            v-model="(unavailableDate.item as AvailabilityDate).tagLogic"
                                            :items="tagLogicOptions"
                                            label="For Matches With..."
                                            hide-details
                                        />
                                    </v-col>
                                    <v-col cols="12">
                                        <tag-select
                                            v-model="(unavailableDate.item as AvailabilityDate).tags"
                                            label="...Of These Tags"
                                            hint="No Selection = Apply to All in Range"
                                        />
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
