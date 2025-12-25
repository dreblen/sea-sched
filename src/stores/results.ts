import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

import type * as SeaSched from '@/types'

export const useResultsStore = defineStore('results', () => {
    const schedules = useLocalStorage('results-schedules',[] as SeaSched.Schedule[])

    const maxSchedulesId = computed(() => schedules.value.reduce((p, c) => (p > c.id) ? p : c.id, 0))

    function addSchedule(schedule: SeaSched.Schedule) {
        schedule.id = maxSchedulesId.value + 1
        schedule.name = `#${schedule.id}`
        schedules.value.push(schedule)
    }

    function clearSchedules() {
        schedules.value = []
    }

    return {
        schedules,
        addSchedule,
        clearSchedules,
    }
})
