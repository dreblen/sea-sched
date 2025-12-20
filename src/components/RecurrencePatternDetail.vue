<script setup lang="ts">
import type { RecurrencePattern } from '@/types'

const model = defineModel<RecurrencePattern>()

const intervalOptions = [
    { title: 'Daily', value: 'day' },
    { title: 'Weekly', value: 'week' },
    { title: 'Monthly', value: 'month' },
]

const weeklyOffsetOptions = [
    { title: 'Sunday', value: 1 },
    { title: 'Monday', value: 2 },
    { title: 'Tuesday', value: 3 },
    { title: 'Wednesday', value: 4 },
    { title: 'Thursday', value: 5 },
    { title: 'Friday', value: 6 },
    { title: 'Saturday', value: 7 },
]
</script>

<template>
    <template v-if="model">
        <v-row>
            <v-col cols="12" lg="4">
                <v-text-field label="Name" v-model="model.name"></v-text-field>
            </v-col>
            <v-col cols="12" :sm="(model.interval === 'day') ? 6 : 4" lg="2">
                <v-select
                    v-model="model.interval"
                    :items="intervalOptions"
                    label="Repeat..."
                />
            </v-col>
            <v-col cols="12" :sm="(model.interval === 'day') ? 6 : 4" lg="3" xl="2">
                <v-number-input
                    v-model="model.step"
                    :min="1"
                    label="...every"
                />
            </v-col>
            <v-col cols="12" sm="4" lg="3" xl="2" v-if="model.interval !== 'day'">
                <template v-if="model.interval === 'week'">
                    <v-select
                        v-model="model.weekOffset"
                        :items="weeklyOffsetOptions"
                        label="Day of Week"
                    />
                </template>
                <template v-if="model.interval === 'month'">
                    <v-number-input
                        v-model="model.monthOffset"
                        :min="1"
                        :max="31"
                        label="Day of Month"
                    />
                </template>
            </v-col>
        </v-row>
    </template>
</template>
