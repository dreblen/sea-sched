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

export interface Worker extends Tagged {
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
