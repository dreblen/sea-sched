<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'

interface ListToDetailItem {
    id: number
    name: string
}

const props = defineProps<{
    items: Array<ListToDetailItem>
    vertical?: boolean
    itemTitle?: string
    noActions?: boolean
}>()

const currentItemIds = ref<number[]>()
const currentItemId = computed(() => currentItemIds.value ? currentItemIds.value[0] : undefined)
const currentItem = computed(() => props.items.find(item => item.id === currentItemId.value))

// If our list of items is emptied out, reset our selection since that won't
// happen automatically
watchEffect(() => {
    if (props.items.length === 0) {
        currentItemIds.value = []
    }
})

const showConfirmationDialog = ref(false)

// Vertical versions of the component remove space between list and detail
const verticalPaddingClass = computed(() => props.vertical ? 'my-0' : null)

defineEmits({
    add() { return true },
    remove(id?: number) { return true },
    change(id?: number, name?: string) { return true }
})
</script>

<template>
    <v-container fluid max-height="80vh">
        <v-row>
            <v-col cols="12" :md="(props.vertical) ? 12 : 3" :class="verticalPaddingClass">
                <v-card variant="outlined">
                    <v-card-actions v-if="!props.noActions">
                        <v-row>
                            <v-col class="pr-0">
                                <v-btn block color="error" :disabled="!currentItem" @click="showConfirmationDialog = true">Remove</v-btn>
                            </v-col>
                            <v-col class="pl-0">
                                <v-btn block color="success" @click="$emit('add')">Add</v-btn>
                            </v-col>
                        </v-row>
                    </v-card-actions>
                    <v-list
                        v-model:selected="currentItemIds"
                        mandatory
                        density="compact"
                        item-value="id"
                        :item-title="itemTitle || 'name'"
                        :items="items"
                        max-height="70vh"
                        style="overflow-y: scroll"
                        @update:selected="$emit('change', currentItemId, currentItem ? ((currentItem as unknown) as { [propName: string]: string })[itemTitle || 'name'] : undefined)"
                    />
                </v-card>
            </v-col>
            <v-col v-if="$slots.default" :class="verticalPaddingClass">
                <v-card class="fill-height">
                    <v-card-text>
                        <slot :item="currentItem"></slot>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
        <v-dialog max-width="500px" v-model="showConfirmationDialog" persistent>
            <v-card>
                <v-card-text>
                    Are you sure you want to remove this item?
                </v-card-text>
                <v-card-actions>
                    <v-btn @click="showConfirmationDialog = false">No</v-btn>
                    <v-btn color="error" @click="$emit('remove', currentItemId); showConfirmationDialog = false">Yes</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-container>
    <template v-if="$slots.uncontained">
        <slot name="uncontained" :item="currentItem"></slot>
    </template>
</template>
