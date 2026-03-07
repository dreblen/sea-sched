import type * as SeaSched from '@/types'
import type { Schedule, ScheduleEvent, ScheduleGrade, ScheduleGradeComponent, ScheduleShift, ScheduleSlot, Worker } from '@/wasm/gw'

export function getArray<T>(values: Iterable<T>) {
    const newValues = [] as T[]
    for (const value of values) {
        newValues.push(value)
    }
    return newValues
}

export function getScheduleSlot(slot: ScheduleSlot) {
    const newSlot: SeaSched.ScheduleSlot = {
        id: slot.id,
        name: slot.name.toString(),
        tags: getArray<number>(slot.tags),
        groupId: slot.groupId,
        isRequired: slot.isRequired,
        workerId: slot.workerId,
        affinity: slot.affinity.value,
        affinityNotes: getArray<string>(slot.affinityNotes),
        index: slot.index,
    }

    return newSlot
}

export function getScheduleSlots(slots: Iterable<ScheduleSlot>) {
    const newSlots = [] as SeaSched.ScheduleSlot[]

    for (const slot of slots) {
        newSlots.push(getScheduleSlot(slot))
    }

    return newSlots
}

export function getScheduleShift(shift: ScheduleShift) {
    const newShift: SeaSched.ScheduleShift = {
        id: shift.id,
        name: shift.name.toString(),
        tags: getArray<number>(shift.tags),
        slots: getScheduleSlots(shift.slots),
    }

    return newShift
}

export function getScheduleShifts(shifts: Iterable<ScheduleShift>) {
    const newShifts = [] as SeaSched.ScheduleShift[]

    for (const shift of shifts) {
        newShifts.push(getScheduleShift(shift))
    }

    return newShifts
}

export function getScheduleEvent(event: ScheduleEvent) {
    const newEvent: SeaSched.ScheduleEvent = {
        id: event.id,
        name: event.name.toString(),
        tags: getArray<number>(event.tags),
        calendarDate: event.calendarDate.toString(),
        shifts: getScheduleShifts(event.shifts),
    }

    return newEvent
}

export function getScheduleEvents(events: Iterable<ScheduleEvent>) {
    const newEvents = [] as SeaSched.ScheduleEvent[]

    for (const event of events) {
        newEvents.push(getScheduleEvent(event))
    }

    return newEvents
}

export function getScheduleGradeComponent(component: ScheduleGradeComponent) {
    const newComponent: SeaSched.ScheduleGradeComponent = {
        componentId: component.componentId.value,
        value: component.value,
    }

    return newComponent
}

export function getScheduleGradeComponents(components: Iterable<ScheduleGradeComponent>) {
    const newComponents = [] as SeaSched.ScheduleGradeComponent[]

    for (const component of components) {
        newComponents.push(getScheduleGradeComponent(component))
    }

    return newComponents
}

export function getScheduleGrade(grade: ScheduleGrade) {
    const newGrade: SeaSched.ScheduleGrade = {
        overall: grade.overall,
        components: getScheduleGradeComponents(grade.components),
    }

    return newGrade
}

export function getSchedule(schedule: Schedule) {
    const newSchedule: SeaSched.Schedule = {
        id: schedule.id,
        name: schedule.name.toString(),
        events: getScheduleEvents(schedule.events),
        steps: [], // XXX
        grade: getScheduleGrade(schedule.grade),
        notesConverted: schedule.notesConverted,
        hash: schedule.hash.toString(),
    }

    return newSchedule
}

export function getSchedules(schedules: Iterable<Schedule>) {
    const newSchedules = [] as SeaSched.Schedule[]

    for (const schedule of schedules) {
        newSchedules.push(getSchedule(schedule))
    }

    return newSchedules
}
