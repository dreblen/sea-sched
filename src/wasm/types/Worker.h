#pragma once

#include <vector>

#include "Tagged.h"
#include "AvailabilityDate.h"

using namespace std;

struct Worker : public Tagged {
    bool isActive;
    int eventLimit;
    bool eventLimitRequired;
    int weekLimit;
    bool weekLimitRequired;
    int monthLimit;
    bool monthLimitRequired;
    vector<AvailabilityDate> unavailableDates;
    string notes;
};
