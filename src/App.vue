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
        <v-app-bar
            color="primary"
            v-if="!$route.path.startsWith('/view') && $route.path !== '/'"
            density="compact"
        >
            <v-app-bar-title>
                <v-tabs align-tabs="center" bg-color="primary">
                    <v-tab v-for="tab in tabs" :key="tab.name" :to="tab.to">
                        {{ tab.name }}
                    </v-tab>
                </v-tabs>
            </v-app-bar-title>
            <template #prepend>
                <v-app-bar-nav-icon
                    icon="mdi-home"
                    to="/"
                />
            </template>
        </v-app-bar>
        <v-main>
            <router-view></router-view>
        </v-main>
    </v-app>
</template>
