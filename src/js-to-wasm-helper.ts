import type * as SeaSched from '@/types'
import type { GradeComponent, MainModule, ScheduleEvent, ScheduleShift, ScheduleSlot, Tag, TagAffinity, Worker } from '@/wasm/gw'

export function getVectorInt(wasm: MainModule, values: number[]) {
    const newValues = new wasm.VectorInt()
    for (const value of values) {
        newValues.push_back(value)
    }
    return newValues
}

export function getVectorString(wasm: MainModule, values: string[]) {
    const newValues = new wasm.VectorString()
    for (const value of values) {
        newValues.push_back(value)
    }
    return newValues
}

export function getScheduleSlot(wasm: MainModule, slot: SeaSched.ScheduleSlot) {
    const newSlot: ScheduleSlot = {
        id: slot.id,
        name: slot.name,
        tags: getVectorInt(wasm, slot.tags),
        groupId: slot.groupId,
        isRequired: slot.isRequired,
        workerId: slot.workerId || -1,
        affinity: (slot.affinity === undefined) ? wasm.AssignmentAffinity.Undefined : { value: slot.affinity },
        affinityNotes: getVectorString(wasm, slot.affinityNotes || []),
        index: slot.index || -1,
    }

    return newSlot
}

export function getScheduleSlots(wasm: MainModule, slots: SeaSched.ScheduleSlot[]) {
    const newSlots = new wasm.VectorScheduleSlot()

    for (const slot of slots) {
        newSlots.push_back(getScheduleSlot(wasm, slot))
    }

    return newSlots
}

export function getScheduleShift(wasm: MainModule, shift: SeaSched.ScheduleShift) {
    const newShift: ScheduleShift = {
        id: shift.id,
        name: shift.name,
        tags: getVectorInt(wasm, shift.tags),
        slots: getScheduleSlots(wasm, shift.slots),
    }

    return newShift
}

export function getScheduleShifts(wasm: MainModule, shifts: SeaSched.ScheduleShift[]) {
    const newShifts = new wasm.VectorScheduleShift()

    for (const shift of shifts) {
        newShifts.push_back(getScheduleShift(wasm, shift))
    }

    return newShifts
}

export function getScheduleEvent(wasm: MainModule, event: SeaSched.ScheduleEvent) {
    const newScheduleEvent: ScheduleEvent = {
        id: event.id,
        name: event.name,
        tags: getVectorInt(wasm, event.tags),
        calendarDate: event.calendarDate,
        shifts: getScheduleShifts(wasm, event.shifts),
    }

    return newScheduleEvent
}

export function getScheduleEvents(wasm: MainModule, events: SeaSched.ScheduleEvent[]) {
    const newEvents = new wasm.VectorScheduleEvent()

    for (const event of events) {
        newEvents.push_back(getScheduleEvent(wasm, event))
    }

    return newEvents
}

export function getWorker(wasm: MainModule, worker: SeaSched.Worker) {
    const newWorker: Worker = {
        id: worker.id,
        name: worker.name,
        tags: getVectorInt(wasm, worker.tags),
        isActive: worker.isActive,
        eventLimit: worker.eventLimit,
        eventLimitRequired: worker.eventLimitRequired,
        weekLimit: worker.weekLimit,
        weekLimitRequired: worker.weekLimitRequired,
        monthLimit: worker.monthLimit,
        monthLimitRequired: worker.monthLimitRequired,
        unavailableDates: new wasm.VectorAvailabilityDate(),
        notes: worker.notes,
    }

    for (const unavailableDate of worker.unavailableDates) {
        newWorker.unavailableDates.push_back({
            id: unavailableDate.id,
            name: unavailableDate.name,
            tags: getVectorInt(wasm, unavailableDate.tags),
            dateStart: unavailableDate.dateStart,
            dateEnd: unavailableDate.dateEnd,
            tagLogic: unavailableDate.tagLogic,
            notes: unavailableDate.notes,
            isRequired: unavailableDate.isRequired,
        })
    }

    return newWorker
}

export function getWorkers(wasm: MainModule, workers: SeaSched.Worker[]) {
    const newWorkers = new wasm.VectorWorker()

    for (const worker of workers) {
        newWorkers.push_back(getWorker(wasm, worker))
    }

    return newWorkers
}

export function getTag(wasm: MainModule, tag: SeaSched.Tag) {
    const newTag: Tag = {
        id: tag.id,
        name: tag.name,
        type: { value: tag.type },
    }

    return newTag
}

export function getTags(wasm: MainModule, tags: SeaSched.Tag[]) {
    const newTags = new wasm.VectorTag()

    for (const tag of tags) {
        newTags.push_back(getTag(wasm, tag))
    }

    return newTags
}

export function getTagAffinity(wasm: MainModule, tagAffinity: SeaSched.TagAffinity) {
    const newAffinity: TagAffinity = {
        id: tagAffinity.id,
        name: tagAffinity.name,
        tagId1: tagAffinity.tagId1,
        tagId2: tagAffinity.tagId2,
        isPositive: tagAffinity.isPositive,
        isRequired: tagAffinity.isRequired,
        counter: tagAffinity.counter,
    }

    return newAffinity
}

export function getTagAffinities(wasm: MainModule, tagAffinities: SeaSched.TagAffinity[]) {
    const newAffinities = new wasm.VectorTagAffinity()

    for (const affinity of tagAffinities) {
        newAffinities.push_back(getTagAffinity(wasm, affinity))
    }

    return newAffinities
}

export function getTagAffinityMap(wasm: MainModule, map: SeaSched.TagAffinityMap) {
    const newMap = new wasm.TagAffinityMap()

    for (const stringKey of Object.keys(map)) {
        const key = parseInt(stringKey)
        const val = map[key]
        if (val !== undefined) {
            newMap.set(key, val)
        }
    }

    return newMap
}

export function getTagAffinityMapMap(wasm: MainModule, map: SeaSched.TagAffinityMapMap) {
    const newMap = new wasm.TagAffinityMapMap()

    for (const stringKey of Object.keys(map)) {
        const key = parseInt(stringKey)
        const val = map[key]
        if (val !== undefined) {
            newMap.set(key, getTagAffinityMap(wasm, val))
        }
    }

    return newMap
}

export function getGradeComponent(wasm: MainModule, component: SeaSched.GradeComponent) {
    const newComponent: GradeComponent = {
        id: { value: component.id },
        name: component.name,
        weight: component.weight,
    }

    return newComponent
}

export function getGradeComponents(wasm: MainModule, components: SeaSched.GradeComponent[]) {
    const newComponents = new wasm.VectorGradeComponent()

    for (const component of components) {
        newComponents.push_back(getGradeComponent(wasm, component))
    }

    return newComponents
}
