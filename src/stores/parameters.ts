import { ref } from 'vue'
import { defineStore } from 'pinia'

import type * as SeaSched from '@/types'

export const useParametersStore = defineStore('parameters', () => {
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

    return {
        scope,
        resetScope,
    }
})
