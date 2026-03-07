#pragma once

#include <string>
#include <vector>

#include "AssignmentAffinity.h"

using namespace std;

struct EligibleWorker {
    int workerId;
    AssignmentAffinity affinity;
    vector<string> affinityNotes;
};
