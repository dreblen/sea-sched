import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { useSetupStore } from './setup'
import * as util from '@/util'

import type * as SeaSched from '@/types'

export const useParametersStore = defineStore('parameters', () => {
    const setup = useSetupStore()
    
    const currentStep = ref(1)

    const scope = ref<SeaSched.Scope>({
        id: 1,
        name: 'Default Scope',
        dateStart: '1900-01-01',
        dateEnd: '1900-01-01',
        events: [],
        weeks: [],
        months: []
    })

    function resetScope() {
        scope.value = {
            id: 1,
            name: 'Default Scope',
            dateStart: '1900-01-01',
            dateEnd: '1900-01-01',
            events: [],
            weeks: [],
            months: []
        }
    }

    const maxWeekId = computed(() => scope.value.weeks.reduce((p, c) => (p > c.id) ? p : c.id, 0))
    const maxMonthId = computed(() => scope.value.months.reduce((p, c) => (p > c.id) ? p : c.id, 0))

    function addWeek(dateStart: string, dateEnd: string) {
        scope.value.weeks.push({
            id: maxWeekId.value + 1,
            name: '',
            dateStart,
            dateEnd,
            tags: []
        })
    }

    function addMonth(dateStart: string, dateEnd: string) {
        scope.value.months.push({
            id: maxMonthId.value + 1,
            name: '',
            dateStart,
            dateEnd,
            tags: []
        })
    }

    ////////////////////////////////////////////////////////////////////////////
    // Scope Events
    ////////////////////////////////////////////////////////////////////////////

    // XXX: It's not good how much this repeats logic from the setup store

    const maxEventId = computed(() => scope.value.events.reduce((p, c) => (p > c.id) ? p : c.id, 0))

    function addEvent() {
        const newEvent: SeaSched.ScopeEvent = {
            id: maxEventId.value + 1,
            name: `New Event ${maxEventId.value + 1}`,
            tags: [],
            shifts: [],
            calendarDate: '1900-01-01'
        }
        scope.value.events.push(newEvent)

        return newEvent
    }

    function removeEvent(id?: number) {
        if (id === undefined) {
            return
        }
        scope.value.events = scope.value.events.filter((e) => e.id !== id)
    }

    function addEventShift(eventId: number) {
        const event = scope.value.events.find((e) => e.id === eventId)
        if (!event) {
            return
        }

        const maxShiftId = event.shifts.reduce((p, c) => (p > c.id) ? p : c.id, 0)

        const newShift: SeaSched.ScopeShift = {
            id: maxShiftId + 1,
            name: `New Shift ${maxShiftId + 1}`,
            tags: [],
            slots: []
        }
        event.shifts.push(newShift)

        return newShift
    }

    function removeEventShift(eventId?: number, shiftId?: number) {
        if (eventId === undefined || shiftId === undefined) {
            return
        }

        const event = scope.value.events.find((e) => e.id === eventId)
        if (!event) {
            return
        }

        event.shifts = event.shifts.filter((s) => s.id !== shiftId)
    }

    function addShiftSlot(eventId: number, shiftId: number) {
        const event = scope.value.events.find((e) => e.id === eventId)
        if (!event) {
            return
        }

        const shift = event.shifts.find((s) => s.id === shiftId)
        if (!shift) {
            return
        }

        const maxSlotId = shift.slots.reduce((p, c) => (p > c.id) ? p : c.id, 0)

        const newSlot: SeaSched.ScopeSlot = {
            id: maxSlotId + 1,
            name: `New Slot ${maxSlotId + 1}`,
            tags: [],
            isRequired: true
        }
        shift.slots.push(newSlot)

        return newSlot
    }

    function removeShiftSlot(eventId?: number, shiftId?: number, slotId?: number) {
        if (eventId === undefined || shiftId === undefined || slotId === undefined) {
            return
        }

        const event = scope.value.events.find((e) => e.id === eventId)
        if (!event) {
            return
        }

        const shift = event.shifts.find((s) => s.id === shiftId)
        if (!shift) {
            return
        }

        shift.slots = shift.slots.filter((s) => s.id !== slotId)
    }

    ////////////////////////////////////////////////////////////////////////////
    // Scope Generation
    ////////////////////////////////////////////////////////////////////////////

    const templateEventIds = ref<number[]>([])

    function generateScopeEvents() {
        // Iterate our base template events and fill out their recurrences
        // within our scope range, avoiding duplicates
        const maxDate = util.getNormalizedDate(scope.value.dateEnd)
        const map = {} as { [calendarDate: string]: number[] }
        for (const e of setup.events.filter((e) => templateEventIds.value.includes(e.id))) {
            for (const r of e.recurrences) {
                switch (r.interval) {
                    case 'day': {
                        let bufferDate = new Date(scope.value.dateStart)

                        do {
                            const ds = util.getDateString(bufferDate)
                            if (map[ds] === undefined) {
                                map[ds] = []
                            }
                            if (!map[ds].includes(e.id)) {
                                map[ds].push(e.id)
                            }

                            bufferDate.setDate(bufferDate.getDate() + r.step)
                        } while (bufferDate <= maxDate)

                        break
                    }
                    case 'week': {
                        // Advance our buffer until it is at the correct day of
                        // the week for the pattern
                        // let bufferDate = new Date(scope.value.dateStart)
                        let bufferDate = util.getNormalizedDate(scope.value.dateStart)
                        while (bufferDate <= maxDate) {
                            if (bufferDate.getDay() + 1 === r.weekOffset) {
                                break
                            } else {
                                bufferDate.setDate(bufferDate.getDate() + 1)
                            }
                        }

                        // If we couldn't find the right day of the week within
                        // our scope range, there is nothing further to do
                        if (bufferDate.getDay() + 1 !== r.weekOffset || bufferDate > maxDate) {
                            break
                        }

                        // Iterate the actual recurrence pattern
                        do {
                            const ds = util.getDateString(bufferDate)
                            if (map[ds] === undefined) {
                                map[ds] = []
                            }
                            if (!map[ds].includes(e.id)) {
                                map[ds].push(e.id)
                            }

                            bufferDate.setDate(bufferDate.getDate() + (7 * r.step))
                        } while (bufferDate <= maxDate)

                        break
                    }
                    case 'month': {
                        // Initialize our buffer to the correct day of the month
                        // in the starting month of our scope range
                        let bufferDate = util.getNormalizedDate(scope.value.dateStart)
                        bufferDate.setDate(r.monthOffset)

                        // Iterate the recurrence pattern
                        do {
                            // Skip this iteration if we had to go before the
                            // start of the scope range for the initialization
                            if (bufferDate < util.getNormalizedDate(scope.value.dateStart)) {
                                bufferDate.setMonth(bufferDate.getMonth() + 1)
                                continue
                            }

                            const ds = util.getDateString(bufferDate)
                            if (map[ds] === undefined) {
                                map[ds] = []
                            }
                            if (!map[ds].includes(e.id)) {
                                map[ds].push(e.id)
                            }

                            bufferDate.setMonth(bufferDate.getMonth() + r.step)
                        } while (bufferDate <= maxDate)

                        break
                    }
                }
            }
        }

        // Build our final list of in-scope events
        scope.value.events = []
        for (const dateString in map) {
            for (const eventId of map[dateString] as number[]) {
                const event = setup.events.find((e) => e.id === eventId)
                if (event === undefined) {
                    continue
                }

                // Create a new scope event from the setup event, replicating
                // its properties and tags
                const newEvent = addEvent()
                newEvent.name = `${event.name} (${dateString})`
                newEvent.calendarDate = dateString
                for (const tag of event.tags) {
                    newEvent.tags.push(tag)
                }

                for (const shift of event.shifts) {
                    const newShift = addEventShift(newEvent.id)
                    if (newShift === undefined) {
                        continue
                    }

                    newShift.name = shift.name
                    for (const tag of shift.tags) {
                        newShift.tags.push(tag)
                    }

                    for (const slot of shift.slots) {
                        const newSlot = addShiftSlot(newEvent.id, newShift.id)
                        if (newSlot === undefined) {
                            continue
                        }

                        newSlot.name = slot.name
                        newSlot.isRequired = slot.isRequired
                        for (const tag of slot.tags) {
                            newSlot.tags.push(tag)
                        }
                    }
                }
            }
        }

        // Sort the final list by date, then name
        scope.value.events.sort((a, b) => {
            if (a.calendarDate < b.calendarDate) {
                return -1
            }
            if (a.calendarDate > b.calendarDate) {
                return 1
            }

            if (a.name < b.name) {
                return -1
            }
            if (a.name > b.name) {
                return 1
            }

            return 0
        })
    }

    function generateScopeSegments() {
        scope.value.weeks = []
        scope.value.months = []

        // Iterate our scope range and populate weeks and months within it
        const maxDate = util.getNormalizedDate(scope.value.dateEnd)
        const bufferDate = util.getNormalizedDate(scope.value.dateStart)
        let weekStart = util.getDateString(bufferDate)
        let monthStart = util.getDateString(bufferDate)
        while (bufferDate <= maxDate) {
            const dateString = util.getDateString(bufferDate)
            const tomorrow = util.getNormalizedDate(dateString)
            tomorrow.setDate(tomorrow.getDate() + 1)
            const tomorrowString = util.getDateString(tomorrow)

            // Finish a week?
            if (bufferDate.getDay() === 6) {
                addWeek(weekStart, dateString)
                weekStart = tomorrowString
            }

            // Finish a month?
            if (tomorrow.getDate() === 1) {
                addMonth(monthStart, dateString)
                monthStart = tomorrowString
            }

            // Prep the next iteration
            bufferDate.setDate(bufferDate.getDate() + 1)
        }

        // Finish out any incomplete weeks or months
        bufferDate.setDate(bufferDate.getDate() - 1)
        const dateString = util.getDateString(bufferDate)
        if (dateString >= weekStart) {
            addWeek(weekStart, dateString)
        }
        if (dateString >= monthStart) {
            addMonth(monthStart, dateString)
        }
    }

    function generateScope() {
        generateScopeEvents()
        generateScopeSegments()
    }

    function removeTagReferences(id: number) {
        for (const week of scope.value.weeks) {
            week.tags = week.tags.filter((tId) => tId !== id)
        }
        for (const month of scope.value.months) {
            month.tags = month.tags.filter((tId) => tId !== id)
        }
        for (const event of scope.value.events) {
            event.tags = event.tags.filter((tId) => tId !== id)
            for (const shift of event.shifts) {
                shift.tags = shift.tags.filter((tId) => tId !== id)
                for (const slot of shift.slots) {
                    slot.tags = slot.tags.filter((tId) => tId !== id)
                }
            }
        }
    }

    return {
        currentStep,
        scope,
        resetScope,
        addEvent,
        removeEvent,
        addEventShift,
        removeEventShift,
        addShiftSlot,
        removeShiftSlot,
        templateEventIds,
        generateScope,
        removeTagReferences,
    }
})
