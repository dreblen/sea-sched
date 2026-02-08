<script setup lang="ts">
import type { Worker, AvailabilityDate } from '@/types'
import { ref } from 'vue'
import { useSetupStore } from '@/stores/setup'
import * as util from '@/util'

import ListToDetail from '../ListToDetail.vue'
import TagSelect from '../TagSelect.vue'

const setup = useSetupStore()

// Controls and logic for unavailability date selections
function onRemoveExpiredClick(worker: Worker) {
    const cutoff = util.getDateString()
    worker.unavailableDates = worker.unavailableDates.filter((ad) => ad.dateEnd >= cutoff)
}

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
        if (s === undefined) {
            continue
        }
        local.push(util.getNormalizedDate(s))
    }

    dateStartBuffer.value = local[0] as Date
    dateEndBuffer.value = local[1] as Date
}

function onDatePickerChange(unavailableDate: AvailabilityDate, type: 'start'|'end') {
    const buffer = (type === 'start') ? dateStartBuffer.value : dateEndBuffer.value
    const propName = (type === 'start') ? 'dateStart' : 'dateEnd'

    unavailableDate[propName] = util.getDateString(buffer)
    unavailableDate.name = unavailableDate.dateStart + ' to ' + unavailableDate.dateEnd
}

const tagLogicOptions = [
    { title: 'Any', value: 'any' },
    { title: 'All', value: 'all' },
]
</script>

<template>
    <list-to-detail
        :items="setup.workers"
        v-slot="worker"
        @add="setup.addWorker"
        @remove="setup.removeWorker"
        include-filter
        sorted
    >
        <template v-if="!worker.item">
            No worker currently selected.
        </template>
        <template v-else>
            <v-row>
                <v-col cols="12" sm="6">
                    <v-text-field label="Name" v-model="worker.item.name" hide-details></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                    <tag-select v-model="(worker.item as Worker).tags" />
                </v-col>
                <v-col>
                    <v-switch
                        v-model="(worker.item as Worker).isActive"
                        :label="(worker.item as Worker).isActive ? 'Active' : 'Inactive'"
                        color="primary"
                        hint="Only active workers will be considered for scheduling"
                        persistent-hint
                    >
                    </v-switch>
                </v-col>
                <v-col cols="12">
                    <v-textarea
                        v-model="(worker.item as Worker).notes"
                        label="Notes"
                    />
                </v-col>
            </v-row>
            <v-row>
                <v-col cols="12">
                    <h1 class="text-h4">Assignment Limits</h1>
                </v-col>
                <v-col cols="12" sm="8" md="6" lg="4">
                    <v-number-input
                        v-model="(worker.item as Worker).eventLimit"
                        label="Per Event"
                        hint="0 = No Limit"
                        :min="0"
                    >
                        <template #append>
                            <v-switch
                                v-model="(worker.item as Worker).eventLimitRequired"
                                :label="(worker.item as Worker).eventLimitRequired ? 'Required' : 'Optional'"
                                color="primary"
                                hide-details
                            />
                        </template>
                    </v-number-input>
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
                <v-col cols="12">
                    <h1 class="text-h4">Unavailability</h1>
                    <p>
                        Define specific date ranges that a worker is unavailable
                        for at all or based on certain tag matches. If a worker
                        is never available for a certain shift/etc., use tags at
                        the worker level to avoid repeating logic for new date
                        ranges.
                    </p>
                </v-col>
                <v-col cols="12">
                    <v-dialog max-width="500px">
                        <template #activator="{ props }">
                            <v-btn
                                v-bind="props"
                                color="error"
                                text="Remove All Expired"
                            />
                        </template>
                        <template #default="{ isActive }">
                            <v-card>
                                <v-card-text>
                                    Are you sure you want to remove all
                                    unavailability ranges for this worker that
                                    have an end date in the past?
                                </v-card-text>
                                <v-card-actions>
                                    <v-btn @click="isActive.value = false">No</v-btn>
                                    <v-btn color="error" @click="onRemoveExpiredClick(worker.item as Worker); isActive.value = false">Yes</v-btn>
                                </v-card-actions>
                            </v-card>
                        </template>
                    </v-dialog>
                </v-col>
                <v-col>
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
                                    <v-col cols="12" sm="4">
                                        <v-menu
                                            v-model="showDateStartSelector"
                                            :close-on-content-click="false"
                                        >
                                            <template v-slot:activator="{ props }">
                                                <v-text-field
                                                    v-bind="props"
                                                    label="Range Start"
                                                    :model-value="util.getDateString(dateStartBuffer)"
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
                                    <v-col cols="12" sm="4">
                                        <v-menu
                                            v-model="showDateEndSelector"
                                            :close-on-content-click="false"
                                        >
                                            <template v-slot:activator="{ props }">
                                                <v-text-field
                                                    v-bind="props"
                                                    label="Range End"
                                                    :model-value="util.getDateString(dateEndBuffer)"
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
                                            include-system
                                        />
                                    </v-col>
                                    <v-col cols="12">
                                        <v-switch
                                            v-model="(unavailableDate.item as AvailabilityDate).isRequired"
                                            :label="(unavailableDate.item as AvailabilityDate).isRequired ? 'Required' : 'Optional'"
                                            color="primary"
                                            hide-details
                                        />
                                    </v-col>
                                    <v-col cols="12">
                                        <v-textarea
                                            v-model="(unavailableDate.item as AvailabilityDate).notes"
                                            label="Notes"
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
