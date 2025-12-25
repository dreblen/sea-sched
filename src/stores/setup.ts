import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

import { useParametersStore } from './parameters'
import * as util from '@/util'

import type * as SeaSched from '@/types'

export const useSetupStore = defineStore('setup', () => {
    const parameters = useParametersStore()

    ////////////////////////////////////////////////////////////////////////////
    // Events
    ////////////////////////////////////////////////////////////////////////////

    const events = useLocalStorage('setup-events',[] as SeaSched.Event[])

    function addEvent() {
        const newEvent = util.addEvent(events.value)
        newEvent.recurrences = []
    }

    function removeEvent(id?: number) {
        events.value = (util.removeEvent(events.value, id) as SeaSched.Event[])
    }

    function addEventShift(eventId: number) {
        util.addEventShift(events.value, eventId)
    }

    function removeEventShift(eventId?: number, shiftId?: number) {
        util.removeEventShift(events.value, eventId, shiftId)
    }

    function addShiftSlot(eventId: number, shiftId: number) {
        util.addShiftSlot(events.value, eventId, shiftId)
    }

    function removeShiftSlot(eventId?: number, shiftId?: number, slotId?: number) {
        util.removeShiftSlot(events.value, eventId, shiftId, slotId)
    }

    function addEventRecurrence(eventId: number) {
        const event = events.value.find((e) => e.id === eventId)
        if (!event) {
            return
        }

        const maxRecurrenceId = event.recurrences.reduce((p, c) => (p > c.id) ? p : c.id, 0)

        event.recurrences.push({
            id: maxRecurrenceId + 1,
            name: `Pattern ${maxRecurrenceId + 1}`,
            interval: 'week',
            weekOffset: 1,
            monthOffset: 1,
            step: 1
        })
    }

    function removeEventRecurrence(eventId?: number, recurrenceId?: number) {
        if (eventId === undefined || recurrenceId === undefined) {
            return
        }

        const event = events.value.find((e) => e.id === eventId)
        if (!event) {
            return
        }

        event.recurrences = event.recurrences.filter((r) => r.id !== recurrenceId)
    }

    ////////////////////////////////////////////////////////////////////////////
    // Workers
    ////////////////////////////////////////////////////////////////////////////

    const workers = useLocalStorage('setup-workers', [] as SeaSched.Worker[])
    const maxWorkerId = computed(() => workers.value.reduce((p, c) => (p > c.id) ? p : c.id, 0))

    function addWorker() {
        workers.value.push({
            id: maxWorkerId.value + 1,
            name: `New Worker ${maxWorkerId.value + 1}`,
            tags: [],
            weekLimit: 0,
            weekLimitRequired: false,
            monthLimit: 0,
            monthLimitRequired: false,
            unavailableDates: []
        })
    }

    function removeWorker(id?: number) {
        if (id === undefined) {
            return
        }
        workers.value = workers.value.filter((w) => w.id !== id)
    }

    function addWorkerUnvailableDate(workerId: number) {
        const worker = workers.value.find((w) => w.id === workerId)
        if (!worker) {
            return
        }

        const maxUnvailableDateId = worker.unavailableDates.reduce((p, c) => (p > c.id) ? p : c.id, 0)

        const d = util.getDateString()
        worker.unavailableDates.push({
            id: maxUnvailableDateId + 1,
            name: `${d} to ${d}`,
            tags: [],
            dateStart: d,
            dateEnd: d,
            tagLogic: 'any'
        })
    }

    function removeWorkerUnavailableDate(workerId?: number, unavailableDateId?: number) {
        if (workerId === undefined || unavailableDateId === undefined) {
            return
        }

        const worker = workers.value.find((w) => w.id === workerId)
        if (!worker) {
            return
        }

        worker.unavailableDates = worker.unavailableDates.filter((d) => d.id !== unavailableDateId)
    }

    ////////////////////////////////////////////////////////////////////////////
    // Tags
    ////////////////////////////////////////////////////////////////////////////

    const tags = useLocalStorage('setup-tags', [] as SeaSched.Tag[])
    const maxTagId = computed(() => tags.value.reduce((p, c) => (p > c.id) ? p : c.id, 0))

    function addTag() {
        tags.value.push({
            id: maxTagId.value + 1,
            name: `New Tag ${maxTagId.value + 1}`
        })
    }

    function removeTag(id?: number) {
        if (id === undefined) {
            return
        }
        
        // Remove references to this tag
        parameters.removeTagReferences(id)
        for (const event of events.value) {
            event.tags = event.tags.filter((tId) => tId !== id)
            for (const shift of event.shifts) {
                shift.tags = shift.tags.filter((tId) => tId !== id)
                for (const slot of shift.slots) {
                    slot.tags = slot.tags.filter((tId) => tId !== id)
                }
            }
        }
        for (const worker of workers.value) {
            worker.tags = worker.tags.filter((tId) => tId !== id)
            for (const unavailableDate of worker.unavailableDates) {
                unavailableDate.tags = unavailableDate.tags.filter((tId) => tId !== id)
            }
        }
        tagAffinities.value = tagAffinities.value.filter((a) => a.tagId1 !== id && a.tagId2 !== id)

        // Remove the tag itself
        tags.value = tags.value.filter((t) => t.id !== id)
    }

    ////////////////////////////////////////////////////////////////////////////
    // Tag Affinities
    ////////////////////////////////////////////////////////////////////////////

    const tagAffinities = useLocalStorage('setup-tag-affinities', [] as SeaSched.TagAffinity[])
    const maxTagAffinityId = computed(() => tagAffinities.value.reduce((p, c) => (p > c.id) ? p : c.id, 0))

    const affinitiesByTag = computed(() => {
        const r = {} as { [tagId: number]: SeaSched.TagAffinity[] }

        // Prepopulate empty arrays for each tag
        for (const t of tags.value) {
            r[t.id] = []
        }
        
        // Add affinities from either side of the relationship
        for (const a of tagAffinities.value) {
            r[a.tagId1]?.push(a)
            if (a.tagId1 !== a.tagId2) {
                r[a.tagId2]?.push(a)
            }
        }

        return r
    })

    const affinitiesByTagTag = computed(() => {
        const r = {} as SeaSched.TagAffinityMapMap

        // Populate a double-indexed list of mappings for each tag
        for (const t of tags.value) {
            const map = {} as SeaSched.TagAffinityMap
            for (const t2 of tags.value) {
                map[t2.id] = affinitiesByTag.value[t.id]?.find((a) => (a.tagId1 === t.id && a.tagId2 === t2.id) || (a.tagId2 === t.id && a.tagId1 === t2.id))
            }
            r[t.id] = map
        }

        return r
    })

    function addTagAffinity(tagId1: number, tagId2: number) {
        tagAffinities.value.push({
            id: maxTagAffinityId.value + 1,
            name: '',
            tagId1,
            tagId2,
            isPositive: true,
            isRequired: true,
            counter: 0
        })
    }

    function removeTagAffinity(id: number) {
        tagAffinities.value = tagAffinities.value.filter((a) => a.id !== id)
    }

    return {
        events,
        addEvent,
        removeEvent,
        addEventShift,
        removeEventShift,
        addShiftSlot,
        removeShiftSlot,
        addEventRecurrence,
        removeEventRecurrence,
        workers,
        addWorker,
        removeWorker,
        addWorkerUnvailableDate,
        removeWorkerUnavailableDate,
        tags,
        addTag,
        removeTag,
        tagAffinities,
        affinitiesByTag,
        affinitiesByTagTag,
        addTagAffinity,
        removeTagAffinity,
    }
})
