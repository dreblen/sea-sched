interface Common {
    id: number
    name: string
}

export interface Tag extends Common {
}

interface Tagged extends Common {
    tags: Tag[]
}

export interface TagAffinity extends Common {
    tagId1: number
    tagId2: number
    isPositive: boolean
    isRequired: boolean
    counter: number
}

export interface AvailabilityDate extends Tagged {
    dateStart: string
    dateEnd: string
    tagLogic: 'any'|'all'
}

export interface Worker extends Tagged {
    weekLimit: number
    weekLimitRequired: boolean
    monthLimit: number
    monthLimitRequired: boolean
    unavailableDates: AvailabilityDate[]
}

export interface Slot extends Tagged {
    isRequired: boolean
}

export interface Shift extends Tagged {
    slots: Slot[]
}

export interface RecurrencePattern extends Common {
    interval: 'day'|'week'|'month'
    weekOffset: number
    monthOffset: number
    step: number
}

export interface Event extends Tagged {
    shifts: Shift[]
    recurrences: RecurrencePattern[]
}
