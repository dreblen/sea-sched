#pragma once

#include <vector>
#include <string>

#include "../types/AssignmentAffinity.h"
#include "../types/AssignmentAffinityType.h"
#include "../types/GenerationSlot.h"
#include "../types/ScheduleEvent.h"
#include "../types/EligibleWorker.h"
#include "../types/Schedule.h"
#include "../types/Worker.h"
#include "../types/ScheduleGrade.h"
#include "../types/ScheduleShape.h"
#include "../types/Tag.h"
#include "../types/TagAffinity.h"
#include "../types/GradeComponent.h"

#include "date.h"

using namespace std;

struct WorkerAffinity {
    int workerId;
    AssignmentAffinity affinity;
    vector<string> notes;
};

vector<GenerationSlot> newGenerationSlots(vector<ScheduleEvent>& events);

AssignmentAffinityType getAssignmentAffinityType(AssignmentAffinity value);

vector<EligibleWorker> getEligibleWorkersForSlot(const GenerationSlot& gs, const Schedule& schedule, const MonthAndWeekRanges& scheduleScope, const vector<Worker>& workers, const vector<Tag>& tags, const TagAffinityMapMap& affinitiesByTagTag, const ScheduleShape& scheduleShape, bool returnAll = false);

ScheduleGrade getScheduleGrade(Schedule& schedule, const vector<Worker>& availableWorkers, const vector<struct TagAffinity>& tagAffinities, const vector<GradeComponent>& gradeComponents);
