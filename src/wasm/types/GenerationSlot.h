#pragma once

#include "ScheduleEvent.h"
#include "ScheduleShift.h"
#include "ScheduleSlot.h"

struct GenerationSlot {
    ScheduleEvent* event;
    ScheduleShift* shift;
    ScheduleSlot* slot;
};
