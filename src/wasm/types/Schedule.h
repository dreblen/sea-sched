#pragma once

#include <vector>
#include <string>

#include "Common.h"
#include "ScheduleEvent.h"
#include "ScheduleGrade.h"

using namespace std;

struct Schedule : public Common {
    vector<ScheduleEvent> events;
    // vector<ScheduleStep> steps; // XXX
    ScheduleGrade grade;
    bool notesConverted;
    size_t hash;
};
