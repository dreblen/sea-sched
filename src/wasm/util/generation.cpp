#include <vector>
#include <ranges>
#include <string>
#include <sstream>
#include <set>
#include <cmath>

#include "generation.h"
#include "date.h"
#include "number.h"

using namespace std;

vector<GenerationSlot> newGenerationSlots(vector<ScheduleEvent>& events) {
    vector<GenerationSlot> generationSlots;

    for (ScheduleEvent& event : events) {
        for (ScheduleShift& shift : event.shifts) {
            for (ScheduleSlot& slot : shift.slots) {
                GenerationSlot gs = { &event, &shift, &slot};
                generationSlots.push_back(gs);
            }
        }
    }

    return generationSlots;
}

AssignmentAffinityType getAssignmentAffinityType(AssignmentAffinity value) {
    switch (value) {
        case AssignmentAffinity::Disallowed:
        case AssignmentAffinity::Unwanted:
            return AssignmentAffinityType::Negative;
        case AssignmentAffinity::Required:
        case AssignmentAffinity::Preferred:
            return AssignmentAffinityType::Positive;
        default:
            return AssignmentAffinityType::Neutral;
    }
}

vector<EligibleWorker> getEligibleWorkersForSlot(const GenerationSlot& gs, const Schedule& schedule, const MonthAndWeekRanges& scheduleScope, const vector<Worker>& workers, const vector<Tag>& tags, const TagAffinityMapMap& affinitiesByTagTag, const ScheduleShape& scheduleShape, bool returnAll) {
    vector<EligibleWorker> results;

    // Gather context data about slots that are in the same shift as the one
    // being considered for assignment
    vector<ScheduleSlot*> siblingSlots;
    vector<const Worker*> siblingWorkers;
    vector<int> siblingWorkerTags;
    for (ScheduleSlot& slot : gs.shift->slots) {
        if (slot.groupId != gs.slot->groupId || slot.id == gs.slot->id) {
            continue;
        }

        siblingSlots.push_back(&slot);
        if (slot.workerId > 0) {
            vector<Worker>::const_iterator it = find_if(workers.begin(), workers.end(), [&](const Worker& worker) { return worker.id == slot.workerId; });
            if (it != workers.end()) {
                const Worker worker = *it;
                siblingWorkers.push_back(&worker);
                for (const int tag : worker.tags) {
                    siblingWorkerTags.push_back(tag);
                }
            }
        }
    }
    sort(siblingWorkerTags.begin(), siblingWorkerTags.end());
    siblingWorkerTags.erase(unique(siblingWorkerTags.begin(), siblingWorkerTags.end()), siblingWorkerTags.end());

    // Gather context about which segments apply to the generation slot being
    // considered. This is used to test limits, but we don't want to recalculate
    // it per worker/limit.
    vector<DateRange>::const_iterator thisMonth = find_if(scheduleScope.months.begin(), scheduleScope.months.end(), [&](const DateRange& m) { return gs.event->calendarDate >= m.dateStart && gs.event->calendarDate <= m.dateEnd; });
    vector<DateRange>::const_iterator thisWeek = find_if(scheduleScope.weeks.begin(), scheduleScope.weeks.end(), [&](const DateRange& w) { return gs.event->calendarDate >= w.dateStart && gs.event->calendarDate <= w.dateEnd; });

    // Build a list of tags that need to be considered for affinities
    set<int> slotTags;
    slotTags.insert(gs.event->tags.begin(), gs.event->tags.end());
    slotTags.insert(gs.shift->tags.begin(), gs.shift->tags.end());
    slotTags.insert(gs.slot->tags.begin(), gs.slot->tags.end());

    // Evaluate each worker
    vector<WorkerAffinity> workerAffinities;
    WorkerAffinity affinityBuffer;
    for (const Worker& worker : workers) {
        // If this worker is already assigned to a slot in the same shift, they
        // are not eligible for this slot
        if (find_if(gs.shift->slots.begin(), gs.shift->slots.end(), [&](ScheduleSlot& slot) { return slot.workerId == worker.id; }) != gs.shift->slots.end()) {
            continue;
        }

        ////////////////////////////////////////////////////////////////////////
        // Check the worker's unavailability
        ////////////////////////////////////////////////////////////////////////
        bool isUnavailable = false;
        AssignmentAffinity unavailableAffinity = AssignmentAffinity::Unwanted;
        string unavailableNotes = "";
        for (const AvailabilityDate& unavailableDate : worker.unavailableDates) {
            // If we have a required answer already, don't proceed
            if (isUnavailable && unavailableAffinity != AssignmentAffinity::Unwanted) {
                break;
            }

            // If this event is outside the unavailability boundaries, skip it
            if (gs.event->calendarDate < unavailableDate.dateStart || gs.event->calendarDate > unavailableDate.dateEnd) {
                continue;
            }

            // If the unavailability date has no tags, there is nothing further
            // to check
            if (unavailableDate.tags.size() == 0) {
                isUnavailable = true;
                if (unavailableDate.isRequired) {
                    unavailableAffinity = AssignmentAffinity::Disallowed;
                }
                unavailableNotes = unavailableDate.notes;
                break;
            }

            // For dates inside the unavailability boundaries, test tags
            bool allMatched = true;
            for (int id : unavailableDate.tags) {
                const bool tagMatch = (slotTags.find(id) != slotTags.end());

                // When the tag logic allows for any match, we have an answer
                // after the first positive check
                if (unavailableDate.tagLogic == "any" && tagMatch) {
                    isUnavailable = true;
                    if (unavailableDate.isRequired) {
                        unavailableAffinity = AssignmentAffinity::Disallowed;
                    }
                    unavailableNotes = unavailableDate.notes;
                    break;
                }

                // When the tag logic requires every tag to match, we have an
                // answer only after we're finished or when we have our first
                // negative check
                if (unavailableDate.tagLogic == "all" && !tagMatch) {
                    allMatched = false;
                    break;
                }
            }

            // Finish out the "all" tag logic
            if (unavailableDate.tagLogic == "all" && allMatched) {
                isUnavailable = true;
                if (unavailableDate.isRequired) {
                    unavailableAffinity = AssignmentAffinity::Disallowed;
                }
                unavailableNotes = unavailableDate.notes;
                break;
            }
        }
        if (isUnavailable) {
            affinityBuffer.workerId = worker.id;
            affinityBuffer.affinity = unavailableAffinity;
            affinityBuffer.notes.push_back((unavailableNotes.length() > 0) ? unavailableNotes : "Unavailable");
            workerAffinities.push_back(affinityBuffer);
            affinityBuffer.notes.clear();
            continue;
        }

        ////////////////////////////////////////////////////////////////////////
        // Check the worker's limits
        ////////////////////////////////////////////////////////////////////////
        AssignmentAffinity limitAffinity = AssignmentAffinity::Neutral;
        vector<string> limitNotes;
        if (worker.eventLimit > 0 || worker.weekLimit > 0 || worker.monthLimit > 0) {
            // Check if we have reached our event limit
            if (worker.eventLimit > 0) {
                int numAssignments = 0;
                for (const ScheduleShift& shift : gs.event->shifts) {
                    for (const ScheduleSlot& slot : shift.slots) {
                        if (slot.workerId == worker.id) {
                            numAssignments++;
                        }
                    }
                }

                if (numAssignments >= worker.eventLimit) {
                    ostringstream oss;
                    oss << "Event Limit (" << worker.eventLimit << ")";
                    if (worker.eventLimitRequired) {
                        affinityBuffer.workerId = worker.id;
                        affinityBuffer.affinity = AssignmentAffinity::Disallowed;
                        affinityBuffer.notes.push_back(oss.str());
                        workerAffinities.push_back(affinityBuffer);
                        affinityBuffer.notes.clear();
                        continue;
                    } else {
                        limitAffinity = AssignmentAffinity::Unwanted;
                        limitNotes.push_back(oss.str());
                    }
                }
            }

            // Check if we have reached our week limit
            if (worker.weekLimit > 0 && thisWeek != scheduleScope.weeks.end()) {
                int numAssignments = 0;
                for (const ScheduleEvent& event : schedule.events) {
                    if (event.calendarDate < (*thisWeek).dateStart || event.calendarDate > (*thisWeek).dateEnd) {
                        continue;
                    }

                    for (const ScheduleShift& shift : event.shifts) {
                        for (const ScheduleSlot& slot : shift.slots) {
                            if (slot.workerId == worker.id) {
                                numAssignments++;
                            }
                        }
                    }
                }

                if (numAssignments >= worker.weekLimit) {
                    ostringstream oss;
                    oss << "Week Limit (" << worker.weekLimit << ")";
                    if (worker.weekLimitRequired) {
                        affinityBuffer.workerId = worker.id;
                        affinityBuffer.affinity = AssignmentAffinity::Disallowed;
                        affinityBuffer.notes.push_back(oss.str());
                        workerAffinities.push_back(affinityBuffer);
                        affinityBuffer.notes.clear();
                        continue;
                    } else {
                        limitAffinity = AssignmentAffinity::Unwanted;
                        limitNotes.push_back(oss.str());
                    }
                }
            }

            // Check if we have reached our month limit
            if (worker.monthLimit > 0 && thisMonth != scheduleScope.months.end()) {
                int numAssignments = 0;
                for (const ScheduleEvent& event : schedule.events) {
                    if (event.calendarDate < (*thisMonth).dateStart || event.calendarDate > (*thisMonth).dateEnd) {
                        continue;
                    }

                    for (const ScheduleShift& shift : event.shifts) {
                        for (const ScheduleSlot& slot : shift.slots) {
                            if (slot.workerId == worker.id) {
                                numAssignments++;
                            }
                        }
                    }
                }

                if (numAssignments >= worker.monthLimit) {
                    ostringstream oss;
                    oss << "Month Limit (" << worker.monthLimit << ")";
                    if (worker.monthLimitRequired) {
                        affinityBuffer.workerId = worker.id;
                        affinityBuffer.affinity = AssignmentAffinity::Disallowed;
                        affinityBuffer.notes.push_back(oss.str());
                        workerAffinities.push_back(affinityBuffer);
                        affinityBuffer.notes.clear();
                        continue;
                    } else {
                        limitAffinity = AssignmentAffinity::Unwanted;
                        limitNotes.push_back(oss.str());
                    }
                }
            }
        }
        if (limitAffinity != AssignmentAffinity::Neutral) {
            affinityBuffer.workerId = worker.id;
            affinityBuffer.affinity = limitAffinity;
            affinityBuffer.notes = limitNotes;
            workerAffinities.push_back(affinityBuffer);
            affinityBuffer.notes.clear();
        }

        ////////////////////////////////////////////////////////////////////////
        // Check for any schedule shaping requirements
        ////////////////////////////////////////////////////////////////////////

        if (scheduleShape.minWeeksBetweenEventShift > 0) {
            // Identify the event and shift tags associated with the current
            // slot so we can confidently make comparisons even if they have
            // been renamed in the parameters stage
            vector<int>::const_iterator eventTag = find_if(gs.event->tags.begin(), gs.event->tags.end(), [&](const int id) {
                vector<Tag>::const_iterator tag = find_if(tags.begin(), tags.end(), [=](const Tag& t) { return t.id == id; });
                if (tag == tags.end()) {
                    return false;
                } else {
                    return (*tag).type == TagType::Event;
                }
            });
            vector<int>::const_iterator shiftTag = find_if(gs.shift->tags.begin(), gs.shift->tags.end(), [&](const int id) {
                vector<Tag>::const_iterator tag = find_if(tags.begin(), tags.end(), [=](const Tag& t) { return t.id == id; });
                if (tag == tags.end()) {
                    return false;
                } else {
                    return (*tag).type == TagType::Shift;
                }
            });

            if (eventTag != gs.event->tags.end() && shiftTag != gs.shift->tags.end()) {
                // Work backwards from this event in the schedule trying to find
                // another assignment of this worker in the same type of shift
                vector<ScheduleEvent*> previousEvents;
                string mostRecentDate = "";
                for (const ScheduleEvent& event : schedule.events) {
                    bool eventFinished = false;

                    // Only work with previous events that are more recent than
                    // any previous iteration's result
                    if (event.calendarDate >= gs.event->calendarDate || event.calendarDate <= mostRecentDate) {
                        continue;
                    }

                    // Only work with events with the right tag
                    if (event.tags.end() == find(event.tags.begin(), event.tags.end(), *eventTag)) {
                        continue;
                    }

                    for (const ScheduleShift& shift : event.shifts) {
                        if (eventFinished) {
                            break;
                        }

                        // Only work with shifts with the right tag
                        if (shift.tags.end() == find(shift.tags.begin(), shift.tags.end(), *shiftTag)) {
                            continue;
                        }

                        for (const ScheduleSlot& slot : shift.slots) {
                            if (slot.workerId == worker.id) {
                                mostRecentDate = event.calendarDate;
                                eventFinished = true;
                                break;
                            }
                        }
                    }
                }

                // If we found a match, determine the number of weeks between it
                // and the current slot under consideration
                if (mostRecentDate != "") {
                    // Get the first day of the week for the current slot
                    time_t slotTimestamp = getNormalizedTimestamp(gs.event->calendarDate);
                    tm* slotDate = gmtime(&slotTimestamp);
                    time_t thisSundayTimestamp = slotTimestamp - (slotDate->tm_wday * (60 * 60 * 24));

                    // Get the first day of the week for the previous assignment
                    time_t previousTimestamp = getNormalizedTimestamp(mostRecentDate);
                    tm* previousDate = gmtime(&previousTimestamp);
                    time_t previousSundayTimestamp = previousTimestamp - (previousDate->tm_wday * (60 * 60 * 24));

                    // Determine the gap between the assignments
                    int weeksBetween = (thisSundayTimestamp - previousSundayTimestamp) / (60 * 60 * 24) / 7;

                    // Make sure we have met the requirement
                    if (weeksBetween <= scheduleShape.minWeeksBetweenEventShift) {
                        affinityBuffer.workerId = worker.id;
                        affinityBuffer.affinity = AssignmentAffinity::Disallowed;

                        ostringstream oss;
                        oss << "Shape: Min Weeks Between Event+Shift (" << scheduleShape.minWeeksBetweenEventShift << ")";
                        affinityBuffer.notes.push_back(oss.str());

                        workerAffinities.push_back(affinityBuffer);
                        affinityBuffer.notes.clear();
                        continue;
                    }
                }
            }
        }

        ////////////////////////////////////////////////////////////////////////

        // If there are no tags to consider for this slot/worker, the worker is
        // eligible from this perspective
        if ((slotTags.size() == 0 && siblingWorkerTags.size() == 0) || worker.tags.size() == 0) {
            affinityBuffer.workerId = worker.id;
            affinityBuffer.affinity = AssignmentAffinity::Neutral;
            workerAffinities.push_back(affinityBuffer);
            continue;
        }

        // If this worker has no tag affinities, they are eligible
        vector<TagAffinityMap> affinityMaps;
        for (int id : worker.tags) {
            try {
                TagAffinityMap map = affinitiesByTagTag.at(id);
                if (map.size() > 0) {
                    affinityMaps.push_back(map);
                }
            } catch (out_of_range& e) {
                // Nothing to do
            }
        }
        if (affinityMaps.size() == 0) {
            affinityBuffer.workerId = worker.id;
            affinityBuffer.affinity = AssignmentAffinity::Neutral;
            workerAffinities.push_back(affinityBuffer);
            continue;
        }

        ////////////////////////////////////////////////////////////////////////
        // Check for tag affinities between this worker and the slot, or between
        // this worker and a worker assigned to a sibling slot
        ////////////////////////////////////////////////////////////////////////
        set<int> allTags(slotTags);
        for (int id : siblingWorkerTags) {
            allTags.insert(id);
        }
        bool isStopShort = false;
        for (TagAffinityMap& affinityMap : affinityMaps) {
            // If we've reached a condition that requires no further iterations,
            // stop processing
            if (isStopShort) {
                break;
            }

            for (int tag : allTags) {
                if (isStopShort) {
                    break;
                }

                TagAffinity affinity;
                try {
                    affinity = affinityMap.at(tag);
                } catch (const out_of_range& e) {
                    // If there is no affinity between these tags, add the
                    // worker to the eligible list for this slot
                    affinityBuffer.workerId = worker.id;
                    affinityBuffer.affinity = AssignmentAffinity::Neutral;
                    workerAffinities.push_back(affinityBuffer);
                    continue;
                }

                ostringstream oss;
                oss << affinity.tagId1 << "|" << affinity.tagId2;

                affinityBuffer.workerId = worker.id;
                affinityBuffer.notes.push_back(oss.str());
                if (affinity.isRequired) {
                    if (affinity.isPositive) {
                        affinityBuffer.affinity = AssignmentAffinity::Required;
                    } else {
                        affinityBuffer.affinity = AssignmentAffinity::Disallowed;
                        isStopShort = true;
                    }
                } else {
                    if (affinity.isPositive) {
                        affinityBuffer.affinity = AssignmentAffinity::Preferred;
                    } else {
                        affinityBuffer.affinity = AssignmentAffinity::Unwanted;
                    }
                }
                workerAffinities.push_back(affinityBuffer);
                affinityBuffer.notes.clear();
            }
        }
    }

    // For optional slots, add the special "no assignment" worker ID since that
    // is a valid option to consider. Whether or not it's a good option is
    // deferred to the grading process. We don't do this for required slots
    // because there's no value in doing so like there is for optional ones.
    if (!gs.slot->isRequired) {
        affinityBuffer.workerId = 0;
        affinityBuffer.affinity = AssignmentAffinity::Neutral;
        workerAffinities.push_back(affinityBuffer);
    }

    // Unless we've been told to return all workers with their affinities, don't
    // consider any workers who had at least one "disallowed" affinity, and if
    // there are any workers with a required affinity, only consider them
    vector<int> disallowedWorkerIds;
    vector<int> requiredWorkerIds;
    set<int> possibleWorkerIds;

    for (WorkerAffinity& wa : workerAffinities) {
        switch (wa.affinity) {
            case AssignmentAffinity::Disallowed:
                disallowedWorkerIds.push_back(wa.workerId);
                break;
            case AssignmentAffinity::Required:
                requiredWorkerIds.push_back(wa.workerId);
                break;
            default:
                // Don't care about other possibilities
                break;
        }

        possibleWorkerIds.insert(wa.workerId);
    }

    // If we had any required workers and aren't returning all possibilities,
    // remove any who weren't required from our possible workers list
    if (requiredWorkerIds.size() > 0 && !returnAll) {
        for (int id : possibleWorkerIds) {
            possibleWorkerIds.erase(id);
        }
    }
    // If we had any disallowed workers and aren't returning all possibilities,
    // remove them from our possible workers list
    else if (disallowedWorkerIds.size() > 0 && !returnAll) {
        for (int id : disallowedWorkerIds) {
            possibleWorkerIds.erase(id);
        }
    }

    // Determine a single affinity for each possible worker and add it to the
    // results that we return. We prefer positive or negative over neutral, but
    // negative over positive.
    for (int workerId : possibleWorkerIds) {
        // If this worker has a disallowed affinity, it wins over anything
        AssignmentAffinity affinity = AssignmentAffinity::Neutral;
        if (disallowedWorkerIds.end() != find(disallowedWorkerIds.begin(), disallowedWorkerIds.end(), workerId)) {
            affinity = AssignmentAffinity::Disallowed;
        }
        // If they have a required affinity, it comes next
        else if (requiredWorkerIds.end() != find(requiredWorkerIds.begin(), requiredWorkerIds.end(), workerId)) {
            affinity = AssignmentAffinity::Required;
        }
        // In all other cases, apply the general logic described above
        else {
            AssignmentAffinityType lastType, thisType;

            for (WorkerAffinity& wa : workerAffinities) {
                if (wa.workerId != workerId) {
                    continue;
                }

                lastType = getAssignmentAffinityType(affinity);
                thisType = getAssignmentAffinityType(wa.affinity);

                switch (thisType) {
                    case AssignmentAffinityType::Negative:
                        affinity = wa.affinity;
                        break;
                    case AssignmentAffinityType::Positive:
                        if (lastType != AssignmentAffinityType::Negative) {
                            affinity = wa.affinity;
                        }
                        break;
                    default:
                        // Don't care about other possibilities
                        break;
                }
            }
        }

        // Combine all unique notes specified at our target affinity
        vector<string> allNotes;
        set<string> uniqueNotes;
        for (WorkerAffinity& wa : workerAffinities) {
            if (wa.workerId != workerId || wa.affinity != affinity || wa.notes.size() == 0) {
                continue;
            }

            for (string& note : wa.notes) {
                allNotes.push_back(note);
            }
        }
        uniqueNotes.insert(allNotes.begin(), allNotes.end());

        // Finalize our results for this slot/worker
        EligibleWorker buffer;
        buffer.workerId = workerId;
        buffer.affinity = affinity;
        for (const string& note : uniqueNotes) {
            buffer.affinityNotes.push_back(note);
        }
        results.push_back(buffer);
    }

    return results;
}

ScheduleGrade getScheduleGrade(Schedule& schedule, const vector<Worker>& availableWorkers, const vector<struct TagAffinity>& tagAffinities, const vector<GradeComponent>& gradeComponents) {
    ScheduleGrade grade;

    // Get generation slots for the schedule so it's easier to work with for
    // aggregate calculations. We sort it by date, shift ID, and slot ID so we
    // can test assignment balance later.
    vector<GenerationSlot> gss = newGenerationSlots(schedule.events);
    sort(gss.begin(), gss.end(), [](GenerationSlot& a, GenerationSlot& b) {
        if (a.event->calendarDate != b.event->calendarDate) {
            return a.event->calendarDate < b.event->calendarDate;
        }
        if (a.shift->id != b.shift->id) {
            return a.shift->id < b.shift->id;
        }
        return a.slot->id < b.slot->id;
    });

    ////////////////////////////////////////////////////////////////////////////
    // Slot coverage: What percentage of the total number of slots in the
    // schedule have been filled?
    ////////////////////////////////////////////////////////////////////////////
    {
        ScheduleGradeComponent requiredPortion = {
            GradeComponentType::SlotCoverageRequired,
            0,
        };
        ScheduleGradeComponent optionalPortion = {
            GradeComponentType::SlotCoverageOptional,
            0,
        };

        vector<GenerationSlot> requiredSlots;
        vector<GenerationSlot> optionalSlots;
        int requiredFilled = 0;
        int optionalFilled = 0;

        for (GenerationSlot& gs : gss) {
            if (gs.slot->isRequired) {
                requiredSlots.push_back(gs);
                if (gs.slot->workerId > 0) {
                    requiredFilled++;
                }
            } else {
                optionalSlots.push_back(gs);
                if (gs.slot->workerId > 0) {
                    optionalFilled++;
                }
            }
        }

        // If either of these have zero slots, upgrade them to 100% since it
        // shouldn't penalize a category if it's not relevant, unless this is
        // the one comprehensive-method scenario that assigns no workers to any
        // slot, in which case we treat these as zeroes to push this permutation
        // down in the results.
        size_t numRequiredSlots = requiredSlots.size();
        size_t numOptionalSlots = optionalSlots.size();
        if (numRequiredSlots == 0) {
            if (optionalFilled > 0) {
                requiredPortion.value = 100;
            } else {
                requiredPortion.value = 0;
            }
        } else {
            requiredPortion.value = 100.0 * requiredFilled / numRequiredSlots;
        }
        if (numOptionalSlots == 0) {
            if (requiredFilled > 0) {
                optionalPortion.value = 100;
            } else {
                optionalPortion.value = 0;
            }
        } else {
            optionalPortion.value = 100.0 * optionalFilled / numOptionalSlots;
        }

        grade.components.push_back(requiredPortion);
        grade.components.push_back(optionalPortion);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Balance: Consistency of spacing from one slot assignment to the next for
    // each worker. Frequent assignments will not result in a low grade if every
    // worker is scheduled frequently, but some workers with frequent
    // assignments and some with sparse assignments will lower the grade. This
    // also looks at objectively spreading assignments over the course of the
    // schedule so you don't end up with, for example, two back-to-back
    // assignments in the first two weeks for one worker and two back-to-back
    // assignments in the last two weeks for another worker.
    ////////////////////////////////////////////////////////////////////////////
    {
        // - Start by gathering raw data on assignment spacing for each worker
        map<int, int> stepBufferByWorker;
        map<int, vector<int>> assignmentSpacingByWorker;
        map<int, vector<int>> assignmentStepsByWorker;
        int lastEventId = -1;
        int lastShiftId = -1;
        int step = 0;
        int totalSteps;
        for (GenerationSlot& gs : gss) {
            // Track when we're looking at a new event/shift
            if (gs.event->id != lastEventId || gs.shift->id != lastShiftId) {
                lastEventId = gs.event->id;
                lastShiftId = gs.shift->id;
                step++;
            }

            // If there is no worker assigned to this slot, move on
            if (gs.slot->workerId <= 0) {
                continue;
            }

            // If we have a previous tracker for this worker, calculate the
            // difference and store it
            try {
                int diff = step - stepBufferByWorker.at(gs.slot->workerId);
                assignmentSpacingByWorker[gs.slot->workerId].push_back(diff);
            } catch (const out_of_range& e) {
                // If this is the first time encountering a worker, record a stub
                // entry in case this ends up being their only shift and there is
                // nothing else to measure
                assignmentSpacingByWorker[gs.slot->workerId].push_back(0);
            }

            // Store the current step value for the assigned worker, both in our
            // working buffer for spacing calculations and our permanent record
            // for objective spread calculations.
            stepBufferByWorker[gs.slot->workerId] = step;
            assignmentStepsByWorker[gs.slot->workerId].push_back(step);
        }
        totalSteps = step;

        // - Convert our spacing details into summaries by worker, including workers
        // who didn't make it onto this schedule at all
        vector<int> numAssignments;
        vector<double> avgAssignmentSpacings;
        for (const Worker& w : availableWorkers) {
            try {
                vector<int>& set = assignmentSpacingByWorker.at(w.id);
                numAssignments.push_back(set.size());

                double sum = 0;
                for (int val : set) {
                    sum += val;
                }
                avgAssignmentSpacings.push_back(sum / set.size());
            } catch (const out_of_range& e) {
                numAssignments.push_back(0);
            }
        }

        // - Calculate the total number of worker assignments in the schedule
        // and convert our per-worker counts into percentages so we can
        // determine a normalized count balance.
        int totalNumAssignments = 0;
        int minNumAssignments = 999999;
        int maxNumAssignments = 0;
        for (int val : numAssignments) {
            totalNumAssignments += val;
            if (val < minNumAssignments) {
                minNumAssignments = val;
            }
            if (val > maxNumAssignments) {
                maxNumAssignments = val;
            }
        }
        double numAssignmentsMinPercentage, numAssignmentsMaxPercentage;
        if (totalNumAssignments > 0) {
            numAssignmentsMinPercentage = ((double)minNumAssignments) / totalNumAssignments;
            numAssignmentsMaxPercentage = ((double)maxNumAssignments) / totalNumAssignments;
        }

        // - Calcualte the standard deviation for the assignment spacing, along
        // with the baseline average for comparison when determining the final
        // grade
        double assignmentSpacingStandardDeviation = getStandardDeviation(avgAssignmentSpacings);
        double avgAssignmentSpacing = 0;
        for (double val : avgAssignmentSpacings) {
            avgAssignmentSpacing += val;
        }
        avgAssignmentSpacing /= avgAssignmentSpacings.size();

        // - Convert our assignment step details into segment summaries by
        // worker so we can calculate spread
        vector<double> spreadGradesPerWorker;
        for (const pair<int, vector<int>>& p : assignmentStepsByWorker) {
            const int workerId = p.first;
            const vector<int>& workerSteps = p.second;

            // Divide our total number of steps by the number of assignments for
            // this worker so we can build equal segments appropriate to this
            // worker's assignments
            double increment = ((double)totalSteps) / workerSteps.size();
            vector<int> floorSegments, ceilSegments;
            for (double i = 1; (i * increment) <= totalSteps; i++) {
                floorSegments.push_back(floor(i * increment));
                ceilSegments.push_back(ceil(i * increment));
            }

            // Determine which segments the worker's assignments fall under, and
            // use that information to calculate a spread grade for the worker
            vector<double> gradeBuffers;
            vector<vector<int>*> segmentSets;
            segmentSets.push_back(&floorSegments);
            segmentSets.push_back(&ceilSegments);
            for (const vector<int>* segmentSet : segmentSets) {
                // Gather the raw range data
                set<int> assignmentBuffer;
                for (int step : workerSteps) {
                    for (int i = 0; i < segmentSet->size(); i++) {
                        if (step <= (*segmentSet)[i]) {
                            assignmentBuffer.insert(i);
                            break;
                        }
                    }
                }

                // Determine the number of unique segments the worker was
                // assigned to, and use that to calculate the spread grade
                gradeBuffers.push_back(((double)assignmentBuffer.size()) / segmentSet->size());
            }

            // Store the average of our floor and ceiling grades as the final
            // spread grade for the worker
            double avgGradeBuffer = 0;
            for (double val : gradeBuffers) {
                avgGradeBuffer += val;
            }
            avgGradeBuffer /= gradeBuffers.size();
            spreadGradesPerWorker.push_back(avgGradeBuffer);
        }

        // - Finalize our grade
        ScheduleGradeComponent numAssignmentPortion = {
            GradeComponentType::BalanceCount,
            0,
        };
        if (totalNumAssignments == 0) {
            // This would happen only for the one comprehensive-method iteration
            // that assigns no workers to any slots. This is an objectively bad
            // scenario, so we downgrade the balance rating even though it's
            // technically not a problem in this area specifically.
            numAssignmentPortion.value = 0;
        } else {
            numAssignmentPortion.value = 1 - (numAssignmentsMaxPercentage - numAssignmentsMinPercentage);
            numAssignmentPortion.value = 100.0 * max(0.0, numAssignmentPortion.value);
        }

        ScheduleGradeComponent assignmentSpacingPortion = {
            GradeComponentType::BalanceSpacing,
            0,
        };
        if (avgAssignmentSpacing == 0) {
            // This would happen if every worker was assigned to only one slot,
            // which is perfect balance, or in the comprehensive-method
            // scenario described above, where we would want to downgrade.
            if (totalNumAssignments == 0) {
                assignmentSpacingPortion.value = 0;
            } else {
                assignmentSpacingPortion.value = 100;
            }
        } else {
            assignmentSpacingPortion.value = (avgAssignmentSpacing - assignmentSpacingStandardDeviation) / avgAssignmentSpacing;
            assignmentSpacingPortion.value = 100.0 * max(0.0, assignmentSpacingPortion.value);
        }

        ScheduleGradeComponent spreadPortion = {
            GradeComponentType::BalanceDistribution,
            0,
        };
        if (spreadGradesPerWorker.size() == 0) {
            // This would happen in the specific comprehensive-method scenario
            // mentioned above that we want to downgrade
            spreadPortion.value = 0;
        } else {
            for (double val : spreadGradesPerWorker) {
                spreadPortion.value += val;
            }
            spreadPortion.value /= spreadGradesPerWorker.size();
            spreadPortion.value *= 100.0;
        }

        grade.components.push_back(numAssignmentPortion);
        grade.components.push_back(assignmentSpacingPortion);
        grade.components.push_back(spreadPortion);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Variety of assignments: Frequency of assignment to different shifts and
    // slots. The value here is similar in calculation to the Balance component.
    ////////////////////////////////////////////////////////////////////////////
    {
        struct ShiftAndSlotNames {
            string shiftName;
            string slotName;
        };

        // - Store baseline data on how many unique shifts and slots are
        // available in the schedule, and gather raw data on which shifts and
        // slots each worker has been assigned to
        set<string> uniqueShiftNames, uniqueSlotNames;
        map<int, vector<ShiftAndSlotNames>> assignmentsByWorker;
        for (const GenerationSlot& gs : gss) {
            uniqueShiftNames.insert(gs.shift->name);
            uniqueSlotNames.insert(gs.slot->name);

            if (gs.slot->workerId <= 0) {
                continue;
            }

            assignmentsByWorker[gs.slot->workerId].push_back({ gs.shift->name, gs.slot->name });
        }

        // - Summarize the number of unique shifts and slots for each worker
        vector<int> numUniqueShiftsPerWorker, numUniqueSlotsPerWorker;
        double totalNumUniqueWorkerShifts = 0, totalNumUniqueWorkerSlots = 0;
        for (const pair<int, vector<ShiftAndSlotNames>>& p : assignmentsByWorker) {
            set<string> shifts, slots;
            const vector<ShiftAndSlotNames>& nameSets = p.second;
            for (const ShiftAndSlotNames& names : nameSets) {
                shifts.insert(names.shiftName);
                slots.insert(names.slotName);
            }
            
            numUniqueShiftsPerWorker.push_back(shifts.size());
            numUniqueSlotsPerWorker.push_back(slots.size());

            totalNumUniqueWorkerShifts += shifts.size();
            totalNumUniqueWorkerSlots += slots.size();
        }

        // - Calculate the standard deviations of our shift and slot numbers
        double shiftsStandardDeviation, slotsStandardDeviation;
        shiftsStandardDeviation = getStandardDeviation(numUniqueShiftsPerWorker);
        slotsStandardDeviation = getStandardDeviation(numUniqueSlotsPerWorker);

        // - Finalize our grade
        double shiftPortion, slotPortion;
        if (numUniqueShiftsPerWorker.size() == 0 || numUniqueSlotsPerWorker.size() == 0) {
            // This will happen in the one comprehensive-generation scenario
            // described above regarding balance. If this happens, we want to
            // downgrade the result.
            shiftPortion = 0;
            slotPortion = 0;
        } else {
            double avgUniqueShifts, avgUniqueSlots;
            avgUniqueShifts = totalNumUniqueWorkerShifts / numUniqueShiftsPerWorker.size();
            avgUniqueSlots = totalNumUniqueWorkerSlots / numUniqueSlotsPerWorker.size();

            shiftPortion = (avgUniqueShifts - (shiftsStandardDeviation / uniqueShiftNames.size())) / uniqueShiftNames.size();
            slotPortion = (avgUniqueSlots - (slotsStandardDeviation / uniqueSlotNames.size())) / uniqueSlotNames.size();
        }
        grade.components.push_back({
            GradeComponentType::VarietyAssignments,
            100.0 * (shiftPortion + slotPortion) / 2.0,
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Variety of coworkers: Frequency of assignments with different workers.
    // Higher grades come when not always scheduled with the same person.
    ////////////////////////////////////////////////////////////////////////////
    {
        // - Identify all workers that appear in the schedule
        set<int> scheduleWorkerIds;
        for (const GenerationSlot& gs : gss) {
            if (gs.slot->workerId > 0) {
                scheduleWorkerIds.insert(gs.slot->workerId);
            }
        }

        // - Make a cross join between all the workers that appear in the
        // schedule with an indicator for whether or not the combination appears
        map<int, map<int, bool>> workerPairFlags;
        int numUniqueWorkerPairs = 0;
        for (const int id1 : scheduleWorkerIds) {
            for (const int id2 : scheduleWorkerIds) {
                // Only make a comparison if the second ID is less than the
                // first in order to avoid duplicates
                if (id2 >= id1) {
                    continue;
                }

                try {
                    // This is a no-op
                    workerPairFlags.at(id1).at(id2);
                } catch (const out_of_range& e) {
                    // Add the pairing with a default value
                    workerPairFlags[id1][id2] = false;
                    numUniqueWorkerPairs++;
                }
            }
        }

        // - Iterate the schedule assignments to test each eligible combination
        for (const GenerationSlot& gs : gss) {
            // Skip non-assignments
            if (gs.slot->workerId <= 0) {
                continue;
            }

            // Iterate neighboring slots
            for (const ScheduleSlot& slot : gs.shift->slots) {
                // Skip our base slot
                if (slot.id == gs.slot->id) {
                    continue;
                }

                // Skip non-assignments
                if (slot.workerId <= 0) {
                    continue;
                }

                // Mark this combination as having occurred
                try {
                    workerPairFlags.at(gs.slot->workerId).at(slot.workerId) = true;
                } catch (const out_of_range& e) {
                    // no-op to avoid duplicates
                }
            }
        }

        // - Count the number of unique pairs that occurred
        int numOccurredPairs = 0;
        for (const pair<int,map<int,bool>>& set1 : workerPairFlags) {
            for (const pair<int,bool>& set2 : set1.second) {
                if (set2.second == true) {
                    numOccurredPairs++;
                }
            }
        }

        // - Finalize our grade
        ScheduleGradeComponent component = {
            GradeComponentType::VarietyCoworkers,
            0,
        };
        if (numUniqueWorkerPairs > 0) {
            component.value = 100.0 * numOccurredPairs / numUniqueWorkerPairs;
        }

        grade.components.push_back(component);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Slot affinity: Relative distribution of positive, neutral, and negative
    // affinities between workers and events/shifts/slots at a basic level
    ////////////////////////////////////////////////////////////////////////////
    {
        // - Determine the number of negative, neutral, and positive affinities
        // found in the schedule assignments
        map<AssignmentAffinityType, int> numAffinities;
        int totalAffinities = 0;
        int totalWeightedAffinities = 0;
        for (const GenerationSlot& gs : gss) {
            // Don't count this "affinity" if it's a non-assignment
            if (gs.slot->workerId <= 0) {
                continue;
            }

            AssignmentAffinityType type = getAssignmentAffinityType(gs.slot->affinity);
            numAffinities[type]++;

            totalAffinities++;
            totalWeightedAffinities += (int)type;
        }

        // - Calculate our affinity bias as an average where negative affinities
        // are 0, neutral are 1, and positive are 2
        double avgAffinity = 0;
        if (totalAffinities > 0) {
            avgAffinity = totalWeightedAffinities / totalAffinities;
        }

        // - Check whether or not any positive affinities were possible for the
        // schedule so we don't grade too harshly
        bool hasPositive = false;
        for (const TagAffinity& affinity : tagAffinities) {
            if (affinity.isPositive) {
                hasPositive = true;
                break;
            }
        }

        // - Finalize the grade (the idea is that our scores range from 0 to 2,
        // but 2 is only possible if there are positive affinities; if there are
        // none, we score out of the actual highest score of 1, but if there are
        // then we score out of 2)
        double gradeValue = avgAffinity;
        if (hasPositive) {
            gradeValue /= 2;
        }

        grade.components.push_back({
            GradeComponentType::TagAffinity,
            100.0 * gradeValue,
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Determine overall grade from components
    ////////////////////////////////////////////////////////////////////////////
    double buffer = 0;
    for (ScheduleGradeComponent& component : grade.components) {
        // Look up the definition of this component, and skip it if we can't for
        // some reason
        vector<GradeComponent>::const_iterator it = find_if(gradeComponents.begin(), gradeComponents.end(), [=](const GradeComponent& gc) { return gc.id == component.componentId; });
        if (it == gradeComponents.end()) {
            continue;
        }
        GradeComponent componentDefinition = *it;

        // Normalize the grades to one decimal
        component.value = round(component.value * 10) / 10;

        // Add to the overall total
        buffer += (componentDefinition.weight / 100.0) * component.value;
    }
    grade.overall = min(100.0, buffer);
    grade.overall = round(grade.overall * 10) / 10;

    return grade;
}
