#include <vector>
#include <algorithm>

#include <emscripten/bind.h>
#include "emscripten-bindings.h"

#include "types/GradeComponent.h"
#include "types/Schedule.h"
#include "types/TagAffinity.h"
#include "types/Worker.h"

#include "util/date.h"
#include "util/number.h"
#include "util/schedule.h"
#include "util/generation.h"

using namespace std;

Schedule getComprehensiveScheduleForSeed(u_int64_t seed, const vector<ScheduleEvent>& events, const MonthAndWeekRanges& scheduleScope, const vector<Worker>& workers, const vector<Tag>& tags, const TagAffinityMapMap& affinitiesByTagTag, const ScheduleShape& scheduleShape) {
    Schedule schedule = newSchedule(events, true);
    vector<GenerationSlot> gss = newGenerationSlots(schedule.events);

    vector<int> digits = getBase10toBaseX(seed, workers.size() + 1, gss.size());
    for (int i = 0; i < digits.size(); i++) {
        const int digit = digits[i];
        GenerationSlot& gs = gss[i];

        // Store the sequence used to generate the schedule
        gs.slot->index = i;

        // If this slot already had an assignment in the base schedule, keep it
        // and move on
        if (gs.slot->workerId != -1) {
            continue;
        }

        // If the assigned worker is 0, use that value directly instead of
        // trying to look up a real worker ID, since 0 = no worker
        if (digit == 0) {
            gs.slot->workerId = 0;
            if (gs.slot->isRequired) {
                gs.slot->affinity = AssignmentAffinity::Disallowed;
            } else {
                gs.slot->affinity = AssignmentAffinity::Neutral;
            }
            continue;
        }

        // Otherwise, we're trying to assign a worker based on the digit index
        // value. If this worker isn't valid for the slot though, we mark it as
        // unassigned so we don't generate a bad schedule.
        const int workerId = workers[digit - 1].id;
        vector<EligibleWorker> eligibleWorkers = getEligibleWorkersForSlot(gs, schedule, scheduleScope, workers, tags, affinitiesByTagTag, scheduleShape);
        vector<EligibleWorker>::const_iterator eligibleWorker = find_if(eligibleWorkers.begin(), eligibleWorkers.end(), [=](EligibleWorker& ew) { return ew.workerId == workerId; });
        if (eligibleWorkers.end() == eligibleWorker) {
            gs.slot->workerId = 0;
            if (gs.slot->isRequired) {
                gs.slot->affinity = AssignmentAffinity::Disallowed;
            } else {
                gs.slot->affinity = AssignmentAffinity::Neutral;
            }
            continue;
        }

        gs.slot->workerId = workerId;
        gs.slot->affinity = (*eligibleWorker).affinity;
        gs.slot->affinityNotes = (*eligibleWorker).affinityNotes;
    }

    return schedule;
}

EMSCRIPTEN_DECLARE_VAL_TYPE(VoidFunctionNumber);

vector<Schedule> generateSchedules(VoidFunctionNumber sendProgress, u_int64_t seed, const vector<ScheduleEvent> events, const vector<Worker> workers, const vector<Tag>& tags, const vector<struct TagAffinity>& tagAffinities, const TagAffinityMapMap& affinitiesByTagTag, const vector<GradeComponent>& gradeComponents, const ScheduleShape& scheduleShape, bool isStopShort, u_int64_t permutationThreshold, double overallGradeThreshold, int resultThreshold) {
    vector<Schedule> schedules;
    double lowestGrade = -1;

    int reportingThreshold = 100;

    // Gather context data about the schedule's segments. This is used to test
    // limits, but we don't want to recalculate it for each cycle.
    string scheduleDateStart = "9999-01-01";
    string scheduleDateEnd = "0000-01-01";
    for (const ScheduleEvent& event : events) {
        if (event.calendarDate < scheduleDateStart) {
            scheduleDateStart = event.calendarDate;
        }
        if (event.calendarDate > scheduleDateEnd) {
            scheduleDateEnd = event.calendarDate;
        }
    }
    MonthAndWeekRanges scheduleScope = getMonthsAndWeeksFromDateRange(scheduleDateStart, scheduleDateEnd);

    for (u_int64_t i = 0; i < permutationThreshold; i++) {
        Schedule schedule = getComprehensiveScheduleForSeed(seed + i, events, scheduleScope, workers, tags, affinitiesByTagTag, scheduleShape);

        // Qualify the schedule before including it
        bool shouldKeepResult = true;

        // If a previous iteration has produced the same schedule, don't keep
        // it again
        schedule.hash = getScheduleHash(schedule);
        if (find_if(schedules.begin(), schedules.end(), [&](Schedule s) { return s.hash == schedule.hash; }) != schedules.end()) {
            shouldKeepResult = false;
        }

        // Grade and further qualify the schedule
        schedule.grade = getScheduleGrade(schedule, workers, tagAffinities, gradeComponents);
        if (schedule.grade.overall < overallGradeThreshold) {
            shouldKeepResult = false;
        }

        // Add the schedule to our result list if we still want to keep it
        if (shouldKeepResult) {
            schedules.push_back(schedule);
        }

        // If we've reached our qualified result limit, either stop generating
        // or push out the current lowest grade
        if (schedules.size() >= resultThreshold && isStopShort) {
            break;
        }
        if (schedules.size() > resultThreshold && !isStopShort) {
            // If our new grade is no better than our current lowest grade, get
            // rid of the new schedule without additional checks
            if (schedule.grade.overall <= lowestGrade) {
                schedules.pop_back();
            }
            // Otherwise, sort the list to put the lowest grade at the end, drop
            // it, and update our new lowest grade value
            else {
                sort(schedules.begin(), schedules.end(), [](Schedule a, Schedule b) { return a.grade.overall > b.grade.overall; });
                schedules.pop_back();
                lowestGrade = schedules[schedules.size() - 1].grade.overall;
            }
        }

        if (i % reportingThreshold == 0) {
            sendProgress(reportingThreshold);
        }
    }

    return schedules;
}

EMSCRIPTEN_BINDINGS(GenerationWorker) {
    emscripten::function("generateSchedules", &generateSchedules);

    emscripten::register_type<VoidFunctionNumber>("(a: number) => void");
}
