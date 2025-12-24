// Given a string in the format of YYYY-MM-DD, return a JS Date object for
// that date at midnight local time, to avoid skewing issues
export function getNormalizedDate(dateString: string) {
    const buffer = new Date(dateString + 'T00:00:00Z')
    buffer.setMinutes(buffer.getMinutes() + buffer.getTimezoneOffset())
    return buffer
}

// Given a JS Date object, return a string representing it as YYYY-MM-DD
export function getDateString(date?: Date) {
    if (date === undefined) {
        date = new Date()
    }
    return date.toISOString().split('T')[0] as string
}

////////////////////////////////////////////////////////////////////////////////
// Helpers for managing events in stores
////////////////////////////////////////////////////////////////////////////////

import type { GenericEvent, GenericShift, GenericSlot } from '@/types'

export interface EventManagementStore {
    addEvent: { (): GenericEvent|void }
    removeEvent: { (eventId?: number): void }
    addEventShift: { (eventId: number): GenericShift|void }
    removeEventShift: { (eventId?: number, shiftId?: number): void }
    addShiftSlot: { (eventId: number, shiftId: number): GenericSlot|void }
    removeShiftSlot: { (eventId?: number, shiftId?: number, slotId?: number): void }
}

export function addEvent(events: GenericEvent[]) {
    const maxEventId = events.reduce((p, c) => (p > c.id) ? p : c.id, 0)
    const newEvent: GenericEvent = {
        id: maxEventId + 1,
        name: `New Event ${maxEventId + 1}`,
        tags: [],
        shifts: [],
    }
    
    events.push(newEvent)
    return newEvent
}

export function removeEvent(events: GenericEvent[], id?: number) {
    if (id === undefined) {
        return
    }
    return events.filter((e) => e.id !== id)
}

export function addEventShift(events: GenericEvent[], eventId: number) {
    const event = events.find((e) => e.id === eventId)
    if (!event) {
        return
    }

    const maxShiftId = event.shifts.reduce((p, c) => (p > c.id) ? p : c.id, 0)
    const newShift: GenericShift = {
        id: maxShiftId + 1,
        name: `New Shift ${maxShiftId + 1}`,
        tags: [],
        slots: []
    }

    event.shifts.push(newShift)
    return newShift
}

export function removeEventShift(events: GenericEvent[], eventId?: number, shiftId?: number) {
    if (eventId === undefined || shiftId === undefined) {
        return
    }

    const event = events.find((e) => e.id === eventId)
    if (!event) {
        return
    }

    event.shifts = event.shifts.filter((s) => s.id !== shiftId)
}

export function addShiftSlot(events: GenericEvent[], eventId: number, shiftId: number) {
    const event = events.find((e) => e.id === eventId)
    if (!event) {
        return
    }

    const shift = event.shifts.find((s) => s.id === shiftId)
    if (!shift) {
        return
    }

    const maxSlotId = shift.slots.reduce((p, c) => (p > c.id) ? p : c.id, 0)
    const newSlot: GenericSlot = {
        id: maxSlotId + 1,
        name: `New Slot ${maxSlotId + 1}`,
        tags: [],
        isRequired: true
    }

    shift.slots.push(newSlot)
    return newSlot
}

export function removeShiftSlot(events: GenericEvent[], eventId?: number, shiftId?: number, slotId?: number) {
    if (eventId === undefined || shiftId === undefined || slotId === undefined) {
        return
    }

    const event = events.find((e) => e.id === eventId)
    if (!event) {
        return
    }

    const shift = event.shifts.find((s) => s.id === shiftId)
    if (!shift) {
        return
    }

    shift.slots = shift.slots.filter((s) => s.id !== slotId)
}
