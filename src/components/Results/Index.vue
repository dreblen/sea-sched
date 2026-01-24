<script setup lang="ts">
import { ref } from 'vue'

import ViewEdit from './ViewEdit.vue'

// Prep our list of sub-navigation options for this tab
const currentTab = ref(0)
const tabs = [
    { name: 'View/Edit', component: ViewEdit },
]
</script>

<template>
    <v-tabs v-model="currentTab" align-tabs="center" bg-color="secondary">
        <v-tab v-for="tab in tabs" :key="tab.name">
            {{ tab.name }}
        </v-tab>
    </v-tabs>
    <v-tabs-window v-model="currentTab" style="overflow-y: scroll">
        <v-tabs-window-item v-for="tab in tabs">
            <template v-if="tab.component">
                <component :is="tab.component"></component>
            </template>
        </v-tabs-window-item>
    </v-tabs-window>
</template>
