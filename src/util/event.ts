import type { GenericEvent, GenericShift, GenericSlot } from '@/types'
import { TagType } from '@/types'

/**
 * This is a generic representation of a store that handles events (i.e., either
 * the setup or parameters stores). We define it this way so we can reuse logic
 * between the two.
 */
export interface EventManagementStore {
    addEvent: { (): GenericEvent|void }
    removeEvent: { (eventId?: number): void }
    addEventShift: { (eventId: number): GenericShift|void }
    removeEventShift: { (eventId?: number, shiftId?: number): void }
    addShiftSlot: { (eventId: number, shiftId: number): GenericSlot|void }
    removeShiftSlot: { (eventId?: number, shiftId?: number, slotId?: number): void }
    syncSystemTags?: { (type: TagType): void}
}

/**
 * Creates a new event for the specified list, filling in default values.
 * 
 * @param events List of events that should be modified.
 * @returns The newly created event.
 */
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

/**
 * Create a copy of the given event list excluding an ID. This is intended to be
 * used by the parent store to replace the existing events list and thus achieve
 * removal.
 * 
 * @param events List of events that should be modified.
 * @param id The ID of the event to remove. If not specified, this function will
 * do nothing.
 * @returns Copy of the events list without the specified ID, or nothing if no
 * ID was specified.
 */
export function removeEvent(events: GenericEvent[], id?: number) {
    if (id === undefined) {
        return
    }
    return events.filter((e) => e.id !== id)
}

/**
 * Creates a new shift for the specified event in the specified list, filling in
 * default values.
 * 
 * @param events List of events that should be modified.
 * @param eventId The ID of the event to modify.
 * @returns The newly created shift, or nothing if the event ID was invalid.
 */
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

/**
 * Remove the specified shift from the specified event in the specified event
 * list. The change is made in place, and nothing is returned.
 * 
 * @param events List of events that should be modified.
 * @param eventId The ID of the event to remove the shift from. If not
 * specified, this function will do nothing.
 * @param shiftId The ID of the shift to remove. If not specified, this function
 * will do nothing.
 * @returns Nothing.
 */
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

/**
 * Creates a new slot for the specified shift in the specified event in the
 * specified list, filling in default values.
 * 
 * @param events List of events that should be modified.
 * @param eventId The ID of the event to modify.
 * @param shiftId The ID of the shift to modify.
 * @returns The newly created slot, or nothing if the event and/or shift IDs
 * were invalid.
 */
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
        groupId: 1,
        isRequired: true
    }

    shift.slots.push(newSlot)
    return newSlot
}

/**
 * Remove the specified slot from the specified shift in the specified event in
 * the specified event list. The change is made in place, and nothing is
 * returned.
 * 
 * @param events List of events that should be modified.
 * @param eventId The ID of the event to remove the slot from. If not specified,
 * this function will do nothing.
 * @param shiftId The ID of the shift to remove the slot from. If not specified,
 * this function will do nothing.
 * @param slotId The ID of the slot to remove. If not specified, this function
 * will do nothing.
 * @returns Nothing.
 */
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
