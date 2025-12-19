<script setup lang="ts">
import { useSetupStore } from '@/stores/setup'

import ListToDetail from '../ListToDetail.vue'

const setup = useSetupStore()
</script>

<template>
    <list-to-detail :items="setup.workers" v-slot="worker" @add="setup.addWorker" @remove="setup.removeWorker">
        <template v-if="!worker.item">
            No worker currently selected.
        </template>
        <template v-else>
            <v-row>
                <v-col>
                    <v-text-field label="Name" v-model="worker.item.name"></v-text-field>
                </v-col>
            </v-row>
        </template>
    </list-to-detail>
</template>
