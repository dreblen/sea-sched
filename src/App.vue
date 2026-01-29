<script setup lang="ts">
// Prep our list of overall navigation tabs
const tabs = [
    { name: 'Setup', to: '/setup' },
    { name: 'Scheduling Parameters', to: '/parameters' },
    { name: 'Results', to: '/results' },
]
</script>

<template>
    <v-app>
        <v-tabs v-if="!$route.path.startsWith('/view')" align-tabs="center" bg-color="primary">
            <v-tab v-for="tab in tabs" :key="tab.name" :to="tab.to">
                {{ tab.name }}
            </v-tab>
        </v-tabs>
        <v-main>
            <router-view></router-view>
        </v-main>
    </v-app>
</template>
