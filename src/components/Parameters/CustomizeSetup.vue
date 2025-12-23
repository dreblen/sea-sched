<script setup lang="ts">
import type { ScopeEvent } from '@/types'
import { useParametersStore } from '@/stores/parameters'

import ListToDetail from '../ListToDetail.vue'
import TagSelect from '../TagSelect.vue'
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
</script>

<template>
    <v-row>
        <v-col>
            <v-btn color="error" @click="parameters.generateScope">Reset to Default</v-btn>
        </v-col>
    </v-row>
    <v-row>
        <list-to-detail
            :items="parameters.scope.events"
            v-slot="event"
            @add="parameters.addEvent"
            @remove="parameters.removeEvent"
        >
            <template v-if="!event.item">
            No event currently selected.
            </template>
            <template v-else>
                <v-row>
                    <v-col>
                        <v-text-field label="Name" v-model="event.item.name"></v-text-field>
                    </v-col>
                    <v-col>
                        <tag-select v-model="(event.item as ScopeEvent).tags" />
                    </v-col>
                </v-row>
            </template>
        </list-to-detail>
    </v-row>
</template>
