interface Common {
    id: number
    name: string
}

////////////////////////////////////////////////////////////////////////////////
// Pre-Scope/Base Template
////////////////////////////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////////////////////////////
// In-Scope Template
////////////////////////////////////////////////////////////////////////////////

export interface ScopeSlot extends Tagged {
    isRequired: boolean
}

export interface ScopeShift extends Tagged {
    slots: ScopeSlot[]
}

export interface ScopeEvent extends Tagged {
    shifts: ScopeShift[]
    calendarDate: string
}

export interface ScopeSegment extends Tagged {
    dateStart: string
    dateEnd: string
}

export interface Scope extends Common {
    dateStart: string
    dateEnd: string
    events: ScopeEvent[]
    weeks: ScopeSegment[]
    months: ScopeSegment[]
}
