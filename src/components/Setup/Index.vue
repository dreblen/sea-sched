<script setup lang="ts">
import { ref } from 'vue'

import Events from './Events.vue'
import Workers from './Workers.vue'
import Tags from './Tags.vue'
import Grading from './Grading.vue'
import Shaping from './Shaping.vue'
import ImportExport from './ImportExport.vue'

// Prep our list of sub-navigation options for this tab
const currentTab = ref(0)
const tabs = [
    { name: 'Events', component: Events },
    { name: 'Workers', component: Workers },
    { name: 'Tags', component: Tags },
    { name: 'Grading', component: Grading },
    { name: 'Shaping', component: Shaping },
    { name: 'Import/Export', component: ImportExport },
]
</script>

<template>
    <v-tabs v-model="currentTab" align-tabs="center" bg-color="secondary">
        <v-tab v-for="tab in tabs" :key="tab.name">
            {{ tab.name }}
        </v-tab>
    </v-tabs>
    <v-tabs-window v-model="currentTab" style="overflow-y: auto">
        <v-tabs-window-item v-for="tab in tabs">
            <template v-if="tab.component">
                <component :is="tab.component"></component>
            </template>
        </v-tabs-window-item>
    </v-tabs-window>
</template>
