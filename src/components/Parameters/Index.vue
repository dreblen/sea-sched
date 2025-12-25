<script setup lang="ts">
import { ref } from 'vue'

import { useParametersStore } from '@/stores/parameters'

import SelectDateRange from './SelectDateRange.vue'
import SelectEvents from './SelectEvents.vue'
import CustomizeSetup from './CustomizeSetup.vue'
import Generate from './Generate.vue'

const parameters = useParametersStore()

const steps = [
    { title: 'Select Date Range', value: 1, component: SelectDateRange },
    { title: 'Select Events', value: 2, component: SelectEvents },
    { title: 'Customize Setup', value: 3, component: CustomizeSetup },
    { title: 'Generate Schedules', value: 4, component: Generate },
]

const canAdvance = ref(false)
function onStepComplete() {
    canAdvance.value = true
}
function onStepIncomplete() {
    canAdvance.value = false
}
</script>

<template>
    <v-stepper-vertical v-model="parameters.currentStep" color="primary">
        <v-stepper-vertical-item
            v-for="step of steps"
            :key="step.value"
            v-bind="step"
        >
            <template v-if="step.component">
                <component
                    :is="step.component"
                    @complete="onStepComplete"
                    @incomplete="onStepIncomplete"
                />
            </template>

            <template #next="data">
                <template v-if="data.step < steps.length">
                    <v-btn :disabled="!canAdvance" @click="data.next">Continue</v-btn>
                </template>
                <template v-else>
                    <v-btn :disabled="!canAdvance" @click="$router.push('/results')">View Results</v-btn>
                </template>
            </template>

            <template #prev="data">
                <v-btn v-if="data.step > 1" @click="data.prev">Go Back</v-btn>
            </template>
        </v-stepper-vertical-item>
    </v-stepper-vertical>
</template>
