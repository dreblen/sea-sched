import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage, type RemovableRef } from '@vueuse/core'

import type * as SeaSched from '@/types'

import * as util from '@/util'

export const useResultsStore = defineStore('results', () => {
    const schedules = useLocalStorage('results-schedules',[] as SeaSched.Schedule[])

    const maxSchedulesId = computed(() => schedules.value.reduce((p, c) => (p > c.id) ? p : c.id, 0))
    const scheduleHashes = computed(() => schedules.value.map((s) => util.getScheduleHash(s)))

    function addSchedule(schedule: SeaSched.Schedule) {
        schedule.id = maxSchedulesId.value + 1
        schedule.name = `#${schedule.id}`
        schedules.value.push(schedule)
    }

    function clearSchedules() {
        schedules.value = []
    }

    const weeks = useLocalStorage('results-weeks',[] as SeaSched.ScopeSegment[])
    const months = useLocalStorage('results-months',[] as SeaSched.ScopeSegment[])

    function setScopeSegment(prop: RemovableRef<SeaSched.ScopeSegment[]>, refSegments: SeaSched.ScopeSegment[]) {
        prop.value = []
        for (const segment of refSegments) {
            prop.value.push({
                id: segment.id,
                name: segment.name,
                tags: segment.tags.slice(),
                dateStart: segment.dateStart,
                dateEnd: segment.dateEnd,
            })
        }
    }

    function setScopeSegments(refWeeks: SeaSched.ScopeSegment[], refMonths: SeaSched.ScopeSegment[]) {
        setScopeSegment(weeks, refWeeks)
        setScopeSegment(months, refMonths)
    }

    // We maintain a separate copy of the grade component definitions so we can
    // accurately present the weights that were present at the time of
    // generation even if the user changes the configuration afterwards.
    const gradeComponents = useLocalStorage('results-grade-components', [] as SeaSched.GradeComponent[])

    function setGradeComponents(components: SeaSched.GradeComponent[]) {
        gradeComponents.value = components.slice()
    }

    return {
        schedules,
        scheduleHashes,
        addSchedule,
        clearSchedules,
        weeks,
        months,
        setScopeSegments,
        gradeComponents,
        setGradeComponents,
    }
})
