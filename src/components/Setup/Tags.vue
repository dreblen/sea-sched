<script setup lang="ts">
import { useSetupStore } from '@/stores/setup'

import ListToDetail from '../ListToDetail.vue'

const setup = useSetupStore()
</script>

<template>
    <list-to-detail :items="setup.tags" v-slot="tag" @add="setup.addTag" @remove="setup.removeTag">
        <template v-if="!tag.item">
            No tag currently selected.
        </template>
        <template v-else>
            <v-row>
                <v-col>
                    <v-text-field label="Name" v-model="tag.item.name"></v-text-field>
                </v-col>
            </v-row>
        </template>
    </list-to-detail>
</template>
