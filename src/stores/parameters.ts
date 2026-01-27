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

    const scopeHash = computed(() => util.getScopeHash(scope.value, setup.tags))

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
            name: `${util.getNormalizedDate(dateStart).toLocaleString('default', { month: 'long' })} ${dateStart.substring(0,4)}`,
            dateStart,
            dateEnd,
            tags: []
        })
    }

    ////////////////////////////////////////////////////////////////////////////
    // Scope Events
    ////////////////////////////////////////////////////////////////////////////

    function addEvent() {
        const newEvent = util.addEvent(scope.value.events)
        newEvent.calendarDate = util.getDateString(new Date(scope.value.dateStart))

        return newEvent
    }

    function removeEvent(id?: number) {
        scope.value.events = (util.removeEvent(scope.value.events, id) as SeaSched.ScopeEvent[])
    }

    function addEventShift(eventId: number) {
        return util.addEventShift(scope.value.events, eventId)
    }

    function removeEventShift(eventId?: number, shiftId?: number) {
        util.removeEventShift(scope.value.events, eventId, shiftId)
    }

    function addShiftSlot(eventId: number, shiftId: number) {
        return util.addShiftSlot(scope.value.events, eventId, shiftId)
    }

    function removeShiftSlot(eventId?: number, shiftId?: number, slotId?: number) {
        util.removeShiftSlot(scope.value.events, eventId, shiftId, slotId)
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
                        newSlot.groupId = slot.groupId
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

        const { months, weeks } = util.getMonthsAndWeeksFromDateRange(scope.value.dateStart, scope.value.dateEnd)
        for (const month of months) {
            addMonth(month.dateStart, month.dateEnd)
        }
        for (const week of weeks) {
            addWeek(week.dateStart, week.dateEnd)
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

    ////////////////////////////////////////////////////////////////////////////
    // Schedule Generation Controls
    ////////////////////////////////////////////////////////////////////////////

    const isStopShort = ref(true)
    const isComprehensive = ref(false)
    const permutationThreshold = ref(1000000)
    const overallGradeThreshold = ref(90)
    const resultThreshold = ref(25)

    const baseSchedule = ref<SeaSched.Schedule>()
    const useBaseSchedule = ref(false)

    ////////////////////////////////////////////////////////////////////////////
    // General
    ////////////////////////////////////////////////////////////////////////////

    interface SerializedContent {
        scope: string,
        templateEventIds: string,
    }

    function serialize() {
        const parts: SerializedContent = {
            scope: JSON.stringify(scope.value),
            templateEventIds: JSON.stringify(templateEventIds.value),
        }

        return JSON.stringify(parts)
    }

    function deserialize(json: string) {
        const parts = JSON.parse(json) as SerializedContent
        scope.value = JSON.parse(parts.scope)
        templateEventIds.value = JSON.parse(parts.templateEventIds)
    }

    return {
        currentStep,
        scope,
        scopeHash,
        resetScope,
        addEvent,
        removeEvent,
        addEventShift,
        removeEventShift,
        addShiftSlot,
        removeShiftSlot,
        templateEventIds,
        generateScopeSegments,
        generateScope,
        removeTagReferences,
        isStopShort,
        isComprehensive,
        permutationThreshold,
        overallGradeThreshold,
        resultThreshold,
        baseSchedule,
        useBaseSchedule,
        serialize,
        deserialize,
    }
})
