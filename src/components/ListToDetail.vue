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
    disableRemoveAction?: boolean
    includeFilter?: boolean
    sorted?: boolean
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

// When we have a filter control, we need to track the filter text and the
// resulting matches to become our new item list
const filterText = ref('')
const filteredItems = computed(() => {
    // Without any filter text, we can just use the item list directly
    if (filterText.value === '') {
        return props.items
    }

    // Otherwise, filter based on matches to our title property
    return props.items.filter((item) => {
        const itemTitle: string = (item as any)[props.itemTitle || 'name']
        return itemTitle.toLowerCase().includes(filterText.value.toLowerCase())
    })
})

// If our selected item is no longer part of the filtered list, reset the
// selection so we don't see the details for a filtered-out item
watchEffect(() => {
    if (filteredItems.value.find((item) => item.id === currentItemId.value) === undefined) {
        currentItemIds.value = []
    }
})

// When we want the results to be sorted, we keep a separate list based on the
// filtered list so we can mutate its order without affecting the original
const sortedFilteredItems = computed(() => {
    // If we aren't sorting, we can just use the filtered list directly
    if (props.sorted !== true) {
        return filteredItems.value
    }

    // Otherwise, make a copy of the list and sort it by the title field
    const copy = filteredItems.value.slice().sort((a,b) => {
        const aTitle: string = (a as any)[props.itemTitle || 'name']
        const bTitle: string = (b as any)[props.itemTitle || 'name']

        if (aTitle < bTitle) {
            return -1
        }
        if (aTitle > bTitle) {
            return 1
        }
        return 0
    })

    return copy
})

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
                                <v-btn block color="error" :disabled="!currentItem || disableRemoveAction" @click="showConfirmationDialog = true">Remove</v-btn>
                            </v-col>
                            <v-col class="pl-0">
                                <v-btn block color="success" @click="$emit('add')">Add</v-btn>
                            </v-col>
                        </v-row>
                    </v-card-actions>
                    <v-card-actions v-if="props.includeFilter">
                        <v-text-field
                            v-model="filterText"
                            label="Search"
                            density="compact"
                            clearable
                            @click:clear="filterText = ''"
                            hide-details
                        />
                    </v-card-actions>
                    <v-list
                        v-model:selected="currentItemIds"
                        mandatory
                        density="compact"
                        item-value="id"
                        :item-title="itemTitle || 'name'"
                        :items="sortedFilteredItems"
                        max-height="70vh"
                        @update:selected="$emit('change', currentItemId, currentItem ? ((currentItem as unknown) as { [propName: string]: string })[itemTitle || 'name'] : undefined)"
                    >
                        <template v-if="$slots.append" #append="{ item }">
                            <slot name="append" :item="item"></slot>
                        </template>
                    </v-list>
                    <v-card-actions v-if="$slots.appendActions">
                        <slot name="appendActions"></slot>
                    </v-card-actions>
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
