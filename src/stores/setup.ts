import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

import { useParametersStore } from './parameters'
import * as util from '@/util'

import type * as SeaSched from '@/types'
import { TagType } from '@/types'

export const useSetupStore = defineStore('setup', () => {
    const parameters = useParametersStore()

    ////////////////////////////////////////////////////////////////////////////
    // Events
    ////////////////////////////////////////////////////////////////////////////

    const events = useLocalStorage('setup-events',[] as SeaSched.Event[])

    function serializeEvents() {
        return JSON.stringify(events.value)
    }

    function deserializeEvents(json: string) {
        events.value = JSON.parse(json)
    }

    function addEvent() {
        const newEvent = util.addEvent(events.value)
        newEvent.recurrences = []

        syncSystemTags()
    }

    function removeEvent(id?: number) {
        events.value = (util.removeEvent(events.value, id) as SeaSched.Event[])

        syncSystemTags()
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

    function serializeWorkers() {
        return JSON.stringify(workers.value)
    }

    function deserializeWorkers(json: string) {
        workers.value = JSON.parse(json)
    }

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
            tagLogic: 'any',
            notes: ''
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

    function serializeTags() {
        return JSON.stringify(tags.value)
    }

    function deserializeTags(json: string) {
        tags.value = JSON.parse(json)
    }

    function addTag(type?: SeaSched.TagType) {
        const tag: SeaSched.Tag = {
            id: maxTagId.value + 1,
            name: `New Tag ${maxTagId.value + 1}`,
            type: type || TagType.Custom
        }
        tags.value.push(tag)
        return tag
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

    function syncSystemTags() {
        // Get current list of unique event names and event tag names
        const eventNames = [...new Set(events.value.map((e) => e.name))]
        const eventTagNames = [...new Set(tags.value.filter((t) => t.type === TagType.Event).map((t) => t.name))]
        const matches = eventNames.filter((en) => eventTagNames.find((tn) => tn === `Event: ${en}`))

        // If there are more event names than tag names, we have added an event
        // and need to add a corresponding tag
        if (eventNames.length > eventTagNames.length) {
            for (const eventName of eventNames) {
                if (matches.includes(eventName)) {
                    continue
                }

                const tag = addTag(TagType.Event)
                tag.name = `Event: ${eventName}`

                for(const event of events.value.filter((e) => e.name === eventName)) {
                    event.tags.push(tag.id)
                }

                matches.push(eventName)
                eventTagNames.push(tag.name)
            }
        }

        // If there are more tag names than event names, we have removed an
        // event and need to remove a corresponding tag
        if (eventTagNames.length > eventNames.length) {
            for (const eventTagName of eventTagNames) {
                const simpleName = eventTagName.substring('Event: '.length)
                if (matches.includes(simpleName)) {
                    continue
                }

                const tag = tags.value.find((t) => t.type === TagType.Event && t.name === eventTagName)
                if (tag === undefined) {
                    continue
                }

                removeTag(tag.id)
            }
        }

        // If there are the same number of event names and tag names, either
        // nothing has changed and this is a no-op, or we have renamed an event
        // and need to rename the unmatched tag. We handle the no-op with a
        // check of matches length, so this block is to handle renaming.
        if (eventNames.length === eventTagNames.length && matches.length !== eventNames.length) {
            const unmatchedEventNames = eventNames.filter((n) => !matches.includes(n))
            const unmatchedEventTagNames = eventTagNames.filter((n) => !matches.includes(n.substring('Event: '.length)))

            if (unmatchedEventNames.length !== 1 || unmatchedEventTagNames.length !== 1) {
                // TODO: This shouldn't ever happen; not sure how to respond
                return
            }

            const tag = tags.value.find((t) => t.type === TagType.Event && t.name === unmatchedEventTagNames[0])
            if (tag) {
                tag.name = `Event: ${unmatchedEventNames[0]}`
            }
        }

        // Make sure all events are tagged appropriately
        for (const event of events.value) {
            const tag = tags.value.find((t) => t.type == TagType.Event && t.name === `Event: ${event.name}`)
            if (tag === undefined) {
                continue
            }

            // Remove any event tags that aren't correct
            event.tags = event.tags.filter((id) => {
                const t = tags.value.find((t) => t.id === id)
                return t?.type !== TagType.Event || t.id === tag.id
            })

            // Add the correct tag if needed
            if (!event.tags.includes(tag.id)) {
                event.tags.push(tag.id)
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // Tag Affinities
    ////////////////////////////////////////////////////////////////////////////

    const tagAffinities = useLocalStorage('setup-tag-affinities', [] as SeaSched.TagAffinity[])
    const maxTagAffinityId = computed(() => tagAffinities.value.reduce((p, c) => (p > c.id) ? p : c.id, 0))

    function serializeTagAffinities() {
        return JSON.stringify(tagAffinities.value)
    }

    function deserializeTagAffinities(json: string) {
        tagAffinities.value = JSON.parse(json)
    }

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

    ////////////////////////////////////////////////////////////////////////////
    // General
    ////////////////////////////////////////////////////////////////////////////

    function serialize() {
        const parts = {
            events: serializeEvents(),
            workers: serializeWorkers(),
            tags: serializeTags(),
            tagAffinities: serializeTagAffinities(),
        }

        return JSON.stringify(parts)
    }

    function deserialize(json: string) {
        const parts = JSON.parse(json) as {
            events: string
            workers: string
            tags: string
            tagAffinities: string
        }

        deserializeEvents(parts.events)
        deserializeWorkers(parts.workers)
        deserializeTags(parts.tags)
        deserializeTagAffinities(parts.tagAffinities)
    }

    function reset() {
        const empty = JSON.stringify([])

        deserialize(JSON.stringify({
            events: empty,
            workers: empty,
            tags: empty,
            tagAffinities: empty,
        }))
    }

    return {
        events,
        serializeEvents,
        deserializeEvents,
        addEvent,
        removeEvent,
        addEventShift,
        removeEventShift,
        addShiftSlot,
        removeShiftSlot,
        addEventRecurrence,
        removeEventRecurrence,
        workers,
        serializeWorkers,
        deserializeWorkers,
        addWorker,
        removeWorker,
        addWorkerUnvailableDate,
        removeWorkerUnavailableDate,
        tags,
        serializeTags,
        deserializeTags,
        addTag,
        removeTag,
        syncSystemTags,
        tagAffinities,
        affinitiesByTag,
        affinitiesByTagTag,
        serializeTagAffinities,
        deserializeTagAffinities,
        addTagAffinity,
        removeTagAffinity,
        serialize,
        deserialize,
        reset,
    }
})
