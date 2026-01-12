<script setup lang="ts">
import { computed } from 'vue'

import { useSetupStore } from '@/stores/setup'

const setup = useSetupStore()

const gradeComponentTotal = computed(() => setup.gradeComponents.reduce((t,v) => t + v.weight,0))
const gradeComponentTotalColor = computed(() => {
    if (gradeComponentTotal.value === 100.0) {
        return 'success'
    } else {
        return 'error'
    }
})
</script>

<template>
    <v-container>
        <v-row justify="center">
            <v-col cols="12" sm="8" md="6" lg="5">
                <v-table>
                    <thead>
                        <tr>
                            <th>Component</th>
                            <th>Weight</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="component of setup.gradeComponents" :key="component.id">
                            <td class="text-right">{{ component.name }}</td>
                            <td>
                                <v-number-input
                                    v-model="component.weight"
                                    hide-details
                                    style="max-width: 11em;"
                                    :precision="1"
                                >
                                    <template #append-inner>
                                        %&nbsp;&nbsp;
                                    </template>
                                </v-number-input>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td class="text-right">Total:</td>
                            <td>
                                <v-chip
                                    size="x-large"
                                    :color="gradeComponentTotalColor"
                                >
                                    {{ gradeComponentTotal }}%
                                </v-chip>
                            </td>
                        </tr>
                    </tfoot>
                </v-table>
            </v-col>
        </v-row>
        <v-row justify="center">
            <v-col class="flex-grow-0 flex-shrink-1">
                <v-btn
                    color="error"
                    @click="setup.resetGradeComponents"
                >
                    Reset to Default
                </v-btn>
            </v-col>
        </v-row>
    </v-container>
</template>
