<script setup lang="ts">
import { useSetupStore } from '@/stores/setup'

import type { Val } from 'vuetify/lib/components/VCombobox/VCombobox.mjs'
import type { Tag } from '@/types'

const setup = useSetupStore()

const model = defineModel<Val<Tag,boolean>[]>()
const props = defineProps<{
    label?: string
    hint?: string
}>()
</script>

<template>
    <v-combobox
        v-model="model"
        :items="setup.tags"
        item-title="name"
        item-value="id"
        :label="label || 'Tags'"
        :hint="hint"
        chips
        closable-chips
        multiple
    >
        <template #chip="{ props, item }">
            <v-chip v-bind="props">
                {{ item.title }}
            </v-chip>
        </template>
    </v-combobox>
</template>
