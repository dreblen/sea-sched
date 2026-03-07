#include <vector>

#include "schedule.h"

using namespace std;

Schedule newSchedule(const vector<ScheduleEvent>& events, bool shouldCopyAssignments) {
    Schedule schedule;
    schedule.id = 0;
    schedule.name = "";

    for (const ScheduleEvent& event : events) {
        ScheduleEvent newEvent;
        newEvent.id = event.id;
        newEvent.name = event.name;
        newEvent.tags = event.tags;
        newEvent.calendarDate = event.calendarDate;

        for (const ScheduleShift& shift : event.shifts) {
            ScheduleShift newShift;
            newShift.id = shift.id;
            newShift.name = shift.name;
            newShift.tags = shift.tags;

            for (const ScheduleSlot& slot : shift.slots) {
                ScheduleSlot newSlot;
                newSlot.id = slot.id;
                newSlot.name = slot.name;
                newSlot.tags = slot.tags;
                newSlot.groupId = slot.groupId;
                newSlot.isRequired = slot.isRequired;

                if (shouldCopyAssignments) {
                    newSlot.workerId = slot.workerId;
                    newSlot.affinity = slot.affinity;
                    newSlot.affinityNotes = slot.affinityNotes;
                } else {
                    newSlot.workerId = -1;
                    newSlot.affinity = AssignmentAffinity::Undefined;
                }

                newShift.slots.push_back(newSlot);
            }

            newEvent.shifts.push_back(newShift);
        }

        schedule.events.push_back(newEvent);
    }

    return schedule;
}

size_t getScheduleHash(Schedule schedule) {
    string assignments = "";
    hash<string> stringHasher;

    for (ScheduleEvent event : schedule.events) {
        for (ScheduleShift shift : event.shifts) {
            for (ScheduleSlot slot : shift.slots) {
                assignments.append(to_string(slot.workerId) + ",");
            }
        }
    }

    return stringHasher(assignments);
}
