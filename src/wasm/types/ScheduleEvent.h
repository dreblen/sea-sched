#pragma once

#include <string>
#include <vector>

#include "Tagged.h"
#include "ScheduleShift.h"

struct ScheduleEvent : public Tagged {
    string calendarDate;
    vector<ScheduleShift> shifts;
};
