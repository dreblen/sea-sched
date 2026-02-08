import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

import { useParametersStore } from './parameters'
import * as util from '@/util'

import type * as SeaSched from '@/types'
import { GradeComponentType, TagType } from '@/types'

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

        syncSystemTags(TagType.Event)
    }

    function removeEvent(id?: number) {
        events.value = (util.removeEvent(events.value, id) as SeaSched.Event[])

        syncSystemTags(TagType.Event)
        syncSystemTags(TagType.Shift)
        syncSystemTags(TagType.Slot)
    }

    function addEventShift(eventId: number) {
        util.addEventShift(events.value, eventId)

        syncSystemTags(TagType.Shift)
    }

    function removeEventShift(eventId?: number, shiftId?: number) {
        util.removeEventShift(events.value, eventId, shiftId)

        syncSystemTags(TagType.Shift)
        syncSystemTags(TagType.Slot)
    }

    function addShiftSlot(eventId: number, shiftId: number) {
        util.addShiftSlot(events.value, eventId, shiftId)

        syncSystemTags(TagType.Slot)
    }

    function removeShiftSlot(eventId?: number, shiftId?: number, slotId?: number) {
        util.removeShiftSlot(events.value, eventId, shiftId, slotId)

        syncSystemTags(TagType.Slot)
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
            isActive: true,
            eventLimit: 1,
            eventLimitRequired: false,
            weekLimit: 0,
            weekLimitRequired: false,
            monthLimit: 0,
            monthLimitRequired: false,
            unavailableDates: [],
            notes: ''
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
            notes: '',
            isRequired: true
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

    function syncSystemTags(type: TagType) {
        // We will apply nearly identical logic for events, shifts, and slots,
        // so we just need to apply a few key decision points. We start by
        // establishing context for the appropriate type.
        const tagNames = [...new Set(tags.value.filter((t) => t.type === type).map((t) => t.name))]
        let names = [] as string[]
        let prefix = ''
        switch (type) {
            case TagType.Event: {
                names = [...new Set(events.value.map((e) => e.name))]
                prefix = 'Event: '
                break
            }
            case TagType.Shift: {
                names = [...new Set(events.value.map((e) => e.shifts.map((s) => s.name)).flat())]
                prefix = 'Shift: '
                break
            }
            case TagType.Slot: {
                names = [...new Set(events.value.map((e) => e.shifts.map((s) => s.slots.map((l) => l.name))).flat(2))]
                prefix = 'Slot: '
                break
            }
            default:
                return
        }
        const matches = names.filter((n) => tagNames.find((tn) => tn === `${prefix}${n}`))

        // If there are more object names than tag names, we have added an
        // object and need to add a corresponding tag
        if (names.length > tagNames.length) {
            for (const name of names) {
                if (matches.includes(name)) {
                    continue
                }

                const tag = addTag(type)
                tag.name = `${prefix}${name}`

                switch (type) {
                    case TagType.Event: {
                        for(const event of events.value.filter((e) => e.name === name)) {
                            event.tags.push(tag.id)
                        }
                        break
                    }
                    case TagType.Shift: {
                        for (const event of events.value) {
                            for (const shift of event.shifts.filter((s) => s.name === name)) {
                                shift.tags.push(tag.id)
                            }
                        }
                        break
                    }
                    case TagType.Slot: {
                        for (const event of events.value) {
                            for (const shift of event.shifts) {
                                for (const slot of shift.slots.filter((l) => l.name === name)) {
                                    slot.tags.push(tag.id)
                                }
                            }
                        }
                        break
                    }
                }

                matches.push(name)
                tagNames.push(tag.name)
            }
        }

        // If there are more tag names than object names, we have removed an
        // object and need to remove a corresponding tag
        if (tagNames.length > names.length) {
            for (const tagName of tagNames) {
                const simpleName = tagName.substring(prefix.length)
                if (matches.includes(simpleName)) {
                    continue
                }

                const tag = tags.value.find((t) => t.type === type && t.name === tagName)
                if (tag === undefined) {
                    continue
                }

                removeTag(tag.id)
            }
        }

        // If there are the same number of object names and tag names, either
        // nothing has changed and this is a no-op, or we have renamed an object
        // and need to rename the unmatched tag. We handle the no-op with a
        // check of matches length, so this block is to handle renaming.
        if (names.length === tagNames.length && matches.length !== names.length) {
            const unmatchedNames = names.filter((n) => !matches.includes(n))
            const unmatchedTagNames = tagNames.filter((n) => !matches.includes(n.substring(prefix.length)))

            if (unmatchedNames.length !== 1 || unmatchedTagNames.length !== 1) {
                // TODO: This shouldn't ever happen; not sure how to respond
                return
            }

            const tag = tags.value.find((t) => t.type === type && t.name === unmatchedTagNames[0])
            if (tag) {
                tag.name = `${prefix}${unmatchedNames[0]}`
            }
        }

        // Make sure all objects are tagged appropriately
        for (const event of events.value) {
            if (type === TagType.Event) {
                const tag = tags.value.find((t) => t.type == type && t.name === `${prefix}${event.name}`)
                if (tag === undefined) {
                    continue
                }

                // Remove any event tags that aren't correct
                event.tags = event.tags.filter((id) => {
                    const t = tags.value.find((t) => t.id === id)
                    return t?.type !== type || t.id === tag.id
                })

                // Add the correct tag if needed
                if (!event.tags.includes(tag.id)) {
                    event.tags.push(tag.id)
                }
            } else {
                for (const shift of event.shifts) {
                    if (type === TagType.Shift) {
                        const tag = tags.value.find((t) => t.type == type && t.name === `${prefix}${shift.name}`)
                        if (tag === undefined) {
                            continue
                        }

                        // Remove any shift tags that aren't correct
                        shift.tags = shift.tags.filter((id) => {
                            const t = tags.value.find((t) => t.id === id)
                            return t?.type !== type || t.id === tag.id
                        })

                        // Add the correct tag if needed
                        if (!shift.tags.includes(tag.id)) {
                            shift.tags.push(tag.id)
                        }
                    } else {
                        for (const slot of shift.slots) {
                            const tag = tags.value.find((t) => t.type == type && t.name === `${prefix}${slot.name}`)
                            if (tag === undefined) {
                                continue
                            }

                            // Remove any slot tags that aren't correct
                            slot.tags = slot.tags.filter((id) => {
                                const t = tags.value.find((t) => t.id === id)
                                return t?.type !== type || t.id === tag.id
                            })

                            // Add the correct tag if needed
                            if (!slot.tags.includes(tag.id)) {
                                slot.tags.push(tag.id)
                            }
                        }
                    }
                }
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
    // Grade Components (for weighting)
    ////////////////////////////////////////////////////////////////////////////

    const gradeComponents = useLocalStorage('setup-grade-components', [] as SeaSched.GradeComponent[])
    if (gradeComponents.value.length === 0) {
        resetGradeComponents()
    }

    function resetGradeComponents() {
        gradeComponents.value = []

        gradeComponents.value.push({
            id: GradeComponentType.SlotCoverageRequired,
            name: 'Required Slot Coverage',
            weight: 60,
        })
        gradeComponents.value.push({
            id: GradeComponentType.SlotCoverageOptional,
            name: 'Optional Slot Coverage',
            weight: 2.5,
        })
    
        gradeComponents.value.push({
            id: GradeComponentType.BalanceCount,
            name: 'Balance: Count',
            weight: 10,
        })
        gradeComponents.value.push({
            id: GradeComponentType.BalanceSpacing,
            name: 'Balance: Spacing',
            weight: 2.5,
        })
        gradeComponents.value.push({
            id: GradeComponentType.BalanceDistribution,
            name: 'Balance: Distribution',
            weight: 2.5,
        })
    
        gradeComponents.value.push({
            id: GradeComponentType.VarietyAssignments,
            name: 'Variety: Assignments',
            weight: 2.5,
        })
        gradeComponents.value.push({
            id: GradeComponentType.VarietyCoworkers,
            name: 'Variety: Coworkers',
            weight: 2.5,
        })
    
        gradeComponents.value.push({
            id: GradeComponentType.TagAffinity,
            name: 'General Slot Affinity',
            weight: 17.5,
        })
    }

    function serializeGradeComponents() {
        return JSON.stringify(gradeComponents.value)
    }

    function deserializeGradeComponents(json: string) {
        gradeComponents.value = JSON.parse(json)
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
            gradeComponents: serializeGradeComponents()
        }

        return JSON.stringify(parts)
    }

    function deserialize(json: string) {
        const parts = JSON.parse(json) as {
            events: string
            workers: string
            tags: string
            tagAffinities: string,
            gradeComponents: string
        }

        deserializeEvents(parts.events)
        deserializeWorkers(parts.workers)
        deserializeTags(parts.tags)
        deserializeTagAffinities(parts.tagAffinities)
        deserializeGradeComponents(parts.gradeComponents)
    }

    function reset() {
        const empty = JSON.stringify([])

        deserialize(JSON.stringify({
            events: empty,
            workers: empty,
            tags: empty,
            tagAffinities: empty,
            gradeComponents: empty,
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
        gradeComponents,
        serializeGradeComponents,
        deserializeGradeComponents,
        resetGradeComponents,
        serialize,
        deserialize,
        reset,
    }
})
