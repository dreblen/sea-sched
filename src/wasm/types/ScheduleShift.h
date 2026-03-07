#pragma once

#include <vector>

#include "Tagged.h"
#include "ScheduleSlot.h"

using namespace std;

struct ScheduleShift : public Tagged {
    vector<ScheduleSlot> slots;
};
