interface Common {
    id: number
    name: string
}

////////////////////////////////////////////////////////////////////////////////
// Pre-Scope/Base Template
////////////////////////////////////////////////////////////////////////////////

// Type allows us to distinguish between user-created and system-generated tags.
// The system tags for event, shift, and slot allow the user to set affinity
// with those entities easily without manually recreating the whole structure as
// their own tags.
export enum TagType {
    Custom = 1,
    Event = 2,
    Shift = 3,
    Slot = 4,
}

export interface Tag extends Common {
    type: TagType
}

export interface Tagged extends Common {
    tags: number[] // --> Tag.id
}

export interface TagAffinity extends Common {
    tagId1: number
    tagId2: number
    isPositive: boolean
    isRequired: boolean
    counter: number
}

export interface TagAffinityMap {
    [tagId: number]: TagAffinity|undefined
}

export interface TagAffinityMapMap {
    [tagId: number]: TagAffinityMap
}

export interface AvailabilityDate extends Tagged {
    dateStart: string
    dateEnd: string
    tagLogic: 'any'|'all'
    notes: string
}

export interface Worker extends Tagged {
    isActive: boolean
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

////////////////////////////////////////////////////////////////////////////////
// Schedule Objects
////////////////////////////////////////////////////////////////////////////////

export enum AssignmentAffinityType {
    Negative = 0,
    Neutral = 1,
    Positive = 2
}

export enum AssignmentAffinity {
    Required = 1,
    Preferred = 2,
    Neutral = 3,
    Unwanted = 4,
}

export interface EligibleWorker {
    workerId: number
    affinity: AssignmentAffinity
}

export interface ScheduleSlot extends Tagged {
    isRequired: boolean
    workerId?: number // 0 = Intentionally empty, undefined = Not evaluated
    affinity?: AssignmentAffinity
}

export interface ScheduleShift extends Tagged {
    slots: ScheduleSlot[]
}

export interface ScheduleEvent extends Tagged {
    calendarDate: string
    shifts: ScheduleShift[]
}

export interface ScheduleStep {
    id: number
    sequence: number
    eventId: number
    shiftId: number
    workerId?: number
}

export interface ScheduleGradeComponent {
    name: string
    weight: number
    value: number
}

export interface ScheduleGrade {
    overall: number
    components: ScheduleGradeComponent[]
}

export interface Schedule extends Common {
    events: ScheduleEvent[]
    steps: ScheduleStep[]
    grade?: ScheduleGrade
}

////////////////////////////////////////////////////////////////////////////////
// General Helpers
////////////////////////////////////////////////////////////////////////////////

export interface GenericSlot extends Tagged {
    isRequired: boolean
}

export interface GenericShift extends Tagged {
    slots: GenericSlot[]
}

export interface GenericEvent extends Tagged {
    shifts: GenericShift[]
    recurrences?: RecurrencePattern[]
    calendarDate?: string
}
