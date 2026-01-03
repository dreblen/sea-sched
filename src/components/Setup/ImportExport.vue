<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSetupStore } from '@/stores/setup'

const setup = useSetupStore()

const fullImport = ref('')
const isFullImportValid = computed(() => {
    if (fullImport.value.length === 0) {
        return false
    }

    try {
        JSON.parse(fullImport.value)
        return true
    } catch (e) {
        return false
    }
})

function processFullImport() {
    setup.deserialize(fullImport.value)
}

const fullExport = computed(() => setup.serialize())

function copyFullExportToClipboard() {
    navigator.clipboard.writeText(fullExport.value)
}
</script>

<template>
    <v-container>
        <v-row>
            <v-col cols="12">
                <h1 class="text-h4">Import</h1>
                <p>
                    Note: Importing configuration data will overwrite any
                    current configurations.
                </p>
            </v-col>
            <v-col cols="12">
                <v-textarea
                    v-model="fullImport"
                />
            </v-col>
            <v-col>
                <v-btn
                    :disabled="!isFullImportValid"
                    color="primary"
                    @click="processFullImport"
                >
                    Import Pasted Configuration
                </v-btn>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12">
                <h1 class="text-h4">Export</h1>
            </v-col>
            <v-col>
                <v-textarea
                    v-model="fullExport"
                    readonly
                    append-inner-icon="mdi-content-copy"
                    @click:append-inner="copyFullExportToClipboard"
                />
            </v-col>
        </v-row>
    </v-container>
</template>
