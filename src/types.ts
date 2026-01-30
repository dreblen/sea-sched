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
    notes: string
}

export interface Slot extends Tagged {
    groupId: number
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
    groupId: number
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
    Disallowed = 5,
}

export interface EligibleWorker {
    workerId: number
    affinity: AssignmentAffinity
    affinityNotes?: string[]
}

export interface ScheduleSlot extends Tagged {
    groupId: number
    isRequired: boolean
    workerId?: number // 0 = Intentionally empty, undefined = Not evaluated
    affinity?: AssignmentAffinity
    affinityNotes?: string[]
    index?: number
}

export interface ScheduleShift extends Tagged {
    slots: ScheduleSlot[]
}

export interface ScheduleEvent extends Tagged {
    calendarDate: string
    shifts: ScheduleShift[]
}

export interface ScheduleWeek extends ScopeSegment {
    events: ScheduleEvent[]
}

export interface ScheduleMonth extends ScopeSegment {
    weeks: ScheduleWeek[]
}

export interface ScheduleStep extends Common {
    sequence: number
    eventId: number
    shiftId: number
    slotId: number
    workerId?: number
}

export enum GradeComponentType {
    SlotCoverageRequired = 101,
    SlotCoverageOptional = 102,
    BalanceCount = 201,
    BalanceSpacing = 202,
    BalanceDistribution = 203,
    VarietyAssignments = 301,
    VarietyCoworkers = 302,
    TagAffinity = 401,
}

export interface GradeComponent extends Common {
    id: GradeComponentType
    weight: number
}

export interface ScheduleGradeComponent {
    componentId: GradeComponentType
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
    notesConverted?: boolean
    hash?: string
}

////////////////////////////////////////////////////////////////////////////////
// Schedule Objects for Distribution
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////
// Basic objects for use in rendering/manipulation
////////////////////////////////////////////////////////////

export interface DisplayScheduleSlot {
    name: string
    workerName: string
}

export interface DisplayScheduleSlotGroup {
    slots: DisplayScheduleSlot[]
}

export interface DisplayScheduleShift {
    name: string
    slotGroups: DisplayScheduleSlotGroup[]
}

export interface DisplayScheduleEvent {
    name: string
    calendarDate: string
    shifts: DisplayScheduleShift[]
}

export interface DisplaySchedule {
    events: DisplayScheduleEvent[]
}

////////////////////////////////////////////////////////////
// Same structure as basic objects, but with shorter
// attribute names and support for compression via string
// lookups at the root level
////////////////////////////////////////////////////////////

export interface MinifiedDisplayScheduleSlot {
    n: number // name
    w: number // workerName
}

export interface MinifiedDisplayScheduleSlotGroup {
    s: MinifiedDisplayScheduleSlot[] // slots
}

export interface MinifiedDisplayScheduleShift {
    n: number // name
    g: MinifiedDisplayScheduleSlotGroup[] // slotGroups
}

export interface MinifiedDisplayScheduleEvent {
    n: number // name
    d: number // calendarDate
    s: MinifiedDisplayScheduleShift[] // shifts
}

export interface MinifiedDisplaySchedule {
    e: MinifiedDisplayScheduleEvent[] // events
    s: string[] // strings (compression lookup)
}

////////////////////////////////////////////////////////////////////////////////
// General Helpers
////////////////////////////////////////////////////////////////////////////////

export interface GenericSlot extends Tagged {
    groupId: number
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
