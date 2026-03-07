#pragma once

#include <vector>

#include "../types/Schedule.h"
#include "../types/ScheduleEvent.h"

using namespace std;

Schedule newSchedule(const vector<ScheduleEvent>& events, bool shouldCopyAssignments = false);

size_t getScheduleHash(Schedule schedule);
