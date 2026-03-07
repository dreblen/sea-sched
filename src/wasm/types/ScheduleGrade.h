#pragma once

#include "ScheduleGradeComponent.h"

using namespace std;

struct ScheduleGrade {
    double overall;
    vector<ScheduleGradeComponent> components;
};
