import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

import type * as SeaSched from '@/types'

export const useSetupStore = defineStore('setup', () => {
    ////////////////////////////////////////////////////////////////////////////
    // Events
    ////////////////////////////////////////////////////////////////////////////

    const events = useLocalStorage('setup-events',[] as SeaSched.Event[])
    const maxEventId = computed(() => events.value.reduce((p, c) => (p > c.id) ? p : c.id, 0))

    function addEvent() {
        events.value.push({
            id: maxEventId.value + 1,
            name: `New Event ${maxEventId.value + 1}`,
            tags: [],
            shifts: [],
            recurrences: []
        })
    }

    function removeEvent(id?: number) {
        if (id === undefined) {
            return
        }
        events.value = events.value.filter((e) => e.id !== id)
    }

    function addEventShift(eventId: number) {
        const event = events.value.find((e) => e.id === eventId)
        if (!event) {
            return
        }

        const maxShiftId = event.shifts.reduce((p, c) => (p > c.id) ? p : c.id, 0)

        event.shifts.push({
            id: maxShiftId + 1,
            name: `New Shift ${maxShiftId + 1}`,
            tags: [],
            slots: []
        })
    }

    function removeEventShift(eventId?: number, shiftId?: number) {
        if (eventId === undefined || shiftId === undefined) {
            return
        }

        const event = events.value.find((e) => e.id === eventId)
        if (!event) {
            return
        }

        event.shifts = event.shifts.filter((s) => s.id !== shiftId)
    }

    function addShiftSlot(eventId: number, shiftId: number) {
        const event = events.value.find((e) => e.id === eventId)
        if (!event) {
            return
        }

        const shift = event.shifts.find((s) => s.id === shiftId)
        if (!shift) {
            return
        }

        const maxSlotId = shift.slots.reduce((p, c) => (p > c.id) ? p : c.id, 0)

        shift.slots.push({
            id: maxSlotId + 1,
            name: `New Slot ${maxSlotId + 1}`,
            tags: [],
            isRequired: true
        })
    }

    function removeShiftSlot(eventId?: number, shiftId?: number, slotId?: number) {
        if (eventId === undefined || shiftId === undefined || slotId === undefined) {
            return
        }

        const event = events.value.find((e) => e.id === eventId)
        if (!event) {
            return
        }

        const shift = event.shifts.find((s) => s.id === shiftId)
        if (!shift) {
            return
        }

        shift.slots = shift.slots.filter((s) => s.id !== slotId)
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
            tags: []
        })
    }

    function removeWorker(id?: number) {
        if (id === undefined) {
            return
        }
        workers.value = workers.value.filter((w) => w.id !== id)
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
        for (const event of events.value) {
            event.tags = event.tags.filter((t) => t.id !== id)
        }

        // Remove the tag itself
        tags.value = tags.value.filter((t) => t.id !== id)
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
        tags,
        addTag,
        removeTag,
    }
})
