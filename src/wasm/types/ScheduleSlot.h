#pragma once

#include <vector>
#include <string>

#include "Tagged.h"
#include "AssignmentAffinity.h"

using namespace std;

struct ScheduleSlot : public Tagged {
    int groupId;
    bool isRequired;
    int workerId;
    AssignmentAffinity affinity;
    vector<string> affinityNotes;
    int index;
};
