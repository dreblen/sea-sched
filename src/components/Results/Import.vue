<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSetupStore } from '@/stores/setup'
import { useParametersStore } from '@/stores/parameters'
import { useResultsStore } from '@/stores/results'

import * as utilSchedule from '@/util/schedule'

const setup = useSetupStore()
const parameters = useParametersStore()
const results = useResultsStore()

const importJson = ref('')
const isImportJsonValid = computed(() => {
    if (importJson.value.length === 0) {
        return false
    }

    try {
        JSON.parse(importJson.value.substring(32))
        return true
    } catch (e) {
        return false
    }
})

function processJsonImport() {
    const scopeHash = importJson.value.substring(0,32)
    const schedule = utilSchedule.deserializeSchedule(importJson.value.substring(32))

    // Back up the current scope settings since we're about to replace them
    // temporarily for the sake of the import
    const backupDateStart = parameters.scope.dateStart
    const backupDateEnd = parameters.scope.dateEnd
    const backupWeeks = parameters.scope.weeks.slice()
    const backupMonths = parameters.scope.months.slice()

    // Build scope segments from our schedule min/max dates
    const dateStart = schedule.events.reduce((p,v) => (v.calendarDate < p) ? v.calendarDate : p,'9999-01-01')
    const dateEnd = schedule.events.reduce((p,v) => (v.calendarDate > p) ? v.calendarDate : p,'0000-01-01')
    parameters.scope.dateStart = dateStart
    parameters.scope.dateEnd = dateEnd
    parameters.generateScopeSegments()

    // Reset our results parameters so they have the best chance of rendering
    // the imported schedule correctly
    results.scopeHash = scopeHash
    results.clearSchedules()
    results.setScopeSegments(parameters.scope.weeks, parameters.scope.months)
    results.setGradeComponents(setup.gradeComponents)
    results.setTags(setup.tags)

    // Restore our backed up scope configuration
    parameters.scope.dateStart = backupDateStart
    parameters.scope.dateEnd = backupDateEnd
    parameters.scope.weeks = backupWeeks
    parameters.scope.months = backupMonths

    // Finalize our import
    results.addSchedule(schedule)
    importJson.value = ''
}
</script>

<template>
    <v-container>
        <v-row>
            <v-col cols="12">
                <v-textarea
                    v-model="importJson"
                    label="Paste in a schedule that you have exported previously"
                />
            </v-col>
            <v-col>
                <v-btn
                    :disabled="!isImportJsonValid"
                    color="warning"
                    @click="processJsonImport"
                >
                    Replace Current Results with This Import
                </v-btn>
            </v-col>
        </v-row>
    </v-container>
</template>
