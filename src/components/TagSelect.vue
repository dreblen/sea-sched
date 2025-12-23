<script setup lang="ts">
import { useSetupStore } from '@/stores/setup'

const setup = useSetupStore()

const model = defineModel<number[]>()
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
        :return-object="false"
        :label="label || 'Tags'"
        :hint="hint"
        chips
        closable-chips
        multiple
        hide-selected
        autocomplete="suppress"
    >
        <template #chip="{ props, item }">
            <v-chip v-bind="props">
                {{ item.title }}
            </v-chip>
        </template>
    </v-combobox>
</template>
