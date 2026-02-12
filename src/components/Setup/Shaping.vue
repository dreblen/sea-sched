<script setup lang="ts">
import { useSetupStore } from '@/stores/setup'

const setup = useSetupStore()
</script>

<template>
    <v-container>
        <v-row justify="center">
            <v-col>
                <p>
                    <em>Warning:</em> It is recommended to control the overall
                    shape of generated schedules via tags, limits, unavailability,
                    and grading weights. The controls available on this page will
                    reduce the options available for scheduling rather than just
                    deprioritizing unwanted options, so you should use them only
                    if you have firm requirements that must be honored, and consider
                    relaxing these requirements if you find you are unable to
                    generate an acceptable schedule.
                </p>
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <v-number-input
                    v-model="setup.scheduleShape.minWeeksBetweenEventShift"
                    label="Min weeks between event+shift"
                    hint="Workers will not be assigned to the same shift of the same event until this number of weeks has passed since the previous assignment"
                    :min="0"
                />
            </v-col>
        </v-row>
    </v-container>
</template>
