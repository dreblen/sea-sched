<script setup lang="ts">
import type { Tag, TagAffinity } from '@/types'
import { TagType } from '@/types'

import { computed, ref } from 'vue'
import { useSetupStore } from '@/stores/setup'

import ListToDetail from '../ListToDetail.vue'

const setup = useSetupStore()

const sortedTags = computed(() => {
    const t = setup.tags.slice()
    return t.sort((a, b) => {
        if (a.name < b.name) {
            return -1
        }
        if (a.name > b.name) {
            return 1
        }
        return 0
    })
})

function getAffinity(tagId1: number, tagId2: number) {
    const tagAffinities = setup.affinitiesByTagTag[tagId1]
    if (tagAffinities === undefined) {
        // This should only happen if we have an invalid tag ID
        return
    }
    return tagAffinities[tagId2]
}

function getAffinityExists(tagId1: number, tagId2: number) {
    return getAffinity(tagId1, tagId2) !== undefined
}

function onRelatedTagClick(tagId1: number, tagId2: number) {
    // Check if the affinity already exists, then either add or remove it
    const affinity = getAffinity(tagId1, tagId2)
    if (affinity === undefined) {
        setup.addTagAffinity(tagId1, tagId2)
    } else {
        setup.removeTagAffinity(affinity.id)
    }
}

const isRemoveDisabled = ref(false)
function onSelectedTagChange(id?: number) {
    const tag = setup.tags.find((t) => t.id === id)
    if (tag === undefined) {
        return
    }

    isRemoveDisabled.value = tag.type !== TagType.Custom
}
</script>

<template>
    <list-to-detail
        :items="setup.tags"
        v-slot="tag"
        @add="setup.addTag"
        @remove="setup.removeTag"
        @change="onSelectedTagChange"
        :disable-remove-action="isRemoveDisabled"
        include-filter
        sorted
    >
        <template v-if="!tag.item">
            No tag currently selected.
        </template>
        <template v-else>
            <v-row v-if="(tag.item as Tag).type !== TagType.Custom">
                <v-col>
                    <p>
                        Note: You cannot remove or rename this tag because it is
                        automatically generated.
                    </p>
                </v-col>
            </v-row>
            <v-row>
                <v-col>
                    <v-text-field
                        label="Name"
                        v-model="tag.item.name"
                        :disabled="(tag.item as Tag).type !== TagType.Custom"
                    />
                </v-col>
            </v-row>
            <v-row>
                <v-col>
                    <h1 class="text-h4">Related Tags</h1>
                </v-col>
                <v-col cols="12" v-for="rTag in sortedTags" :key="rTag.id">
                    {{ rTag.name }}
                    <v-row>
                        <v-col class="pb-0" cols="12" sm="3" lg="2">
                            <v-switch
                                :label="getAffinityExists(tag.item.id, rTag.id) ? 'Related' : 'Unrelated'"
                                @click="onRelatedTagClick(tag.item.id, rTag.id)"
                                color="primary"
                                :model-value="getAffinityExists(tag.item.id, rTag.id)"
                                hide-details
                            />
                        </v-col>
                        <template v-if="getAffinityExists(tag.item.id, rTag.id)">
                            <v-col sm="3">
                                <v-switch
                                    v-model="(getAffinity(tag.item.id, rTag.id) as TagAffinity).isRequired"
                                    :label="getAffinity(tag.item.id, rTag.id)?.isRequired ? 'Required' : 'Optional'"
                                    color="primary"
                                    hide-details
                                />
                            </v-col>
                            <v-col sm="3">
                                <v-switch
                                    v-model="(getAffinity(tag.item.id, rTag.id) as TagAffinity).isPositive"
                                    :label="getAffinity(tag.item.id, rTag.id)?.isPositive ? 'Positive' : 'Negative'"
                                    color="success"
                                    hide-details
                                />
                            </v-col>
                        </template>
                    </v-row>
                </v-col>
            </v-row>
        </template>
    </list-to-detail>
</template>
