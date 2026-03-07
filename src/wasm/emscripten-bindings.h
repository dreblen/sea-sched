/**
 * All type bindings are placed in one file to avoid problems with the
 * TypeScript definition generator ignoring #pragma once. This file should be
 * included only once, but there is no include guard to ensure that a double
 * inclusion that would break the TypeScript generator will also cause a compile
 * error.
 */

#include <emscripten/bind.h>

#include <vector>
#include <string>

#include "types/AssignmentAffinity.h"
#include "types/AssignmentAffinityType.h"
#include "types/AvailabilityDate.h"
#include "types/EligibleWorker.h"
#include "types/GradeComponent.h"
#include "types/GradeComponentType.h"
#include "types/Schedule.h"
#include "types/ScheduleGrade.h"
#include "types/ScheduleGradeComponent.h"
#include "types/ScheduleEvent.h"
#include "types/ScheduleShape.h"
#include "types/ScheduleShift.h"
#include "types/ScheduleSlot.h"
#include "types/TagAffinity.h"
#include "types/Tag.h"
#include "types/TagType.h"
#include "types/Worker.h"


using namespace std;

EMSCRIPTEN_BINDINGS(Common) {
    emscripten::register_vector<int>("VectorInt");
    emscripten::register_vector<string>("VectorString");
}

EMSCRIPTEN_BINDINGS(AssignmentAffinity) {
    emscripten::enum_<AssignmentAffinity>("AssignmentAffinity")
        .value("Undefined", AssignmentAffinity::Undefined)
        .value("Required", AssignmentAffinity::Required)
        .value("Preferred", AssignmentAffinity::Preferred)
        .value("Neutral", AssignmentAffinity::Neutral)
        .value("Unwanted", AssignmentAffinity::Unwanted)
        .value("Disallowed", AssignmentAffinity::Disallowed)
    ;
}

EMSCRIPTEN_BINDINGS(AssignmentAffinityType) {
    emscripten::enum_<AssignmentAffinityType>("AssignmentAffinityType")
        .value("Negative", AssignmentAffinityType::Negative)
        .value("Neutral", AssignmentAffinityType::Neutral)
        .value("Positive", AssignmentAffinityType::Positive)
    ;
}

EMSCRIPTEN_BINDINGS(AvailabilityDate) {
    emscripten::value_object<AvailabilityDate>("AvailabilityDate")
        .field("id", &AvailabilityDate::id)
        .field("name", &AvailabilityDate::name)
        .field("tags", &AvailabilityDate::tags)
        .field("dateStart", &AvailabilityDate::dateStart)
        .field("dateEnd", &AvailabilityDate::dateEnd)
        .field("tagLogic", &AvailabilityDate::tagLogic)
        .field("notes", &AvailabilityDate::notes)
        .field("isRequired", &AvailabilityDate::isRequired)
    ;

    emscripten::register_vector<AvailabilityDate>("VectorAvailabilityDate");
}

EMSCRIPTEN_BINDINGS(EligibleWorker) {
    emscripten::value_object<EligibleWorker>("EligibleWorker")
        .field("workerId", &EligibleWorker::workerId)
        .field("affinity", &EligibleWorker::affinity)
        .field("affinityNotes", &EligibleWorker::affinityNotes)
    ;

    emscripten::register_vector<EligibleWorker>("VectorEligibleWorker");
}

EMSCRIPTEN_BINDINGS(GradeComponent) {
    emscripten::value_object<GradeComponent>("GradeComponent")
        .field("id", &GradeComponent::id)
        .field("name", &GradeComponent::name)
        .field("weight", &GradeComponent::weight)
    ;

    emscripten::register_vector<GradeComponent>("VectorGradeComponent");
}

EMSCRIPTEN_BINDINGS(GradeComponentType) {
    emscripten::enum_<GradeComponentType>("GradeComponentType")
        .value("SlotCoverageRequired", GradeComponentType::SlotCoverageRequired)
        .value("SlotCoverageOptional", GradeComponentType::SlotCoverageOptional)
        .value("BalanceCount", GradeComponentType::BalanceCount)
        .value("BalanceSpacing", GradeComponentType::BalanceSpacing)
        .value("BalanceDistribution", GradeComponentType::BalanceDistribution)
        .value("VarietyAssignments", GradeComponentType::VarietyAssignments)
        .value("VarietyCoworkers", GradeComponentType::VarietyCoworkers)
        .value("TagAffinity", GradeComponentType::TagAffinity)
    ;
}

EMSCRIPTEN_BINDINGS(Schedule) {
    emscripten::value_object<Schedule>("Schedule")
        .field("id", &Schedule::id)
        .field("name", &Schedule::name)
        .field("events", &Schedule::events)
        // .field("steps", &Schedule::steps)
        .field("grade", &Schedule::grade)
        .field("notesConverted", &Schedule::notesConverted)
        .field("hash", &Schedule::hash)
    ;

    emscripten::register_vector<Schedule>("VectorSchedule");
}

EMSCRIPTEN_BINDINGS(ScheduleGrade) {
    emscripten::value_object<ScheduleGrade>("ScheduleGrade")
        .field("overall", &ScheduleGrade::overall)
        .field("components", &ScheduleGrade::components)
    ;
}

EMSCRIPTEN_BINDINGS(ScheduleGradeComponent) {
    emscripten::value_object<ScheduleGradeComponent>("ScheduleGradeComponent")
        .field("componentId", &ScheduleGradeComponent::componentId)
        .field("value", &ScheduleGradeComponent::value)
    ;

    emscripten::register_vector<ScheduleGradeComponent>("VectorScheduleGradeComponent");
}

EMSCRIPTEN_BINDINGS(ScheduleEvent) {
    emscripten::value_object<ScheduleEvent>("ScheduleEvent")
        .field("id", &ScheduleEvent::id)
        .field("name", &ScheduleEvent::name)
        .field("tags", &ScheduleEvent::tags)
        .field("calendarDate", &ScheduleEvent::calendarDate)
        .field("shifts", &ScheduleEvent::shifts)
    ;

    emscripten::register_vector<ScheduleEvent>("VectorScheduleEvent");
}

EMSCRIPTEN_BINDINGS(ScheduleShape) {
    emscripten::value_object<ScheduleShape>("ScheduleShape")
        .field("minWeeksBetweenEventShift", &ScheduleShape::minWeeksBetweenEventShift)
    ;
}

EMSCRIPTEN_BINDINGS(ScheduleShift) {
    emscripten::value_object<ScheduleShift>("ScheduleShift")
        .field("id", &ScheduleShift::id)
        .field("name", &ScheduleShift::name)
        .field("tags", &ScheduleShift::tags)
        .field("slots", &ScheduleShift::slots)
    ;

    emscripten::register_vector<ScheduleShift>("VectorScheduleShift");
}

EMSCRIPTEN_BINDINGS(ScheduleSlot) {
    emscripten::value_object<ScheduleSlot>("ScheduleSlot")
        .field("id", &ScheduleSlot::id)
        .field("name", &ScheduleSlot::name)
        .field("tags", &ScheduleSlot::tags)
        .field("groupId", &ScheduleSlot::groupId)
        .field("isRequired", &ScheduleSlot::isRequired)
        .field("workerId", &ScheduleSlot::workerId)
        .field("affinity", &ScheduleSlot::affinity)
        .field("affinityNotes", &ScheduleSlot::affinityNotes)
        .field("index", &ScheduleSlot::index)
    ;

    emscripten::register_vector<ScheduleSlot>("VectorScheduleSlot");
}

EMSCRIPTEN_BINDINGS(Tag) {
    emscripten::register_vector<Tag>("VectorTag");

    emscripten::value_object<Tag>("Tag")
        .field("id", &Tag::id)
        .field("name", &Tag::name)
        .field("type", &Tag::type)
    ;
}

EMSCRIPTEN_BINDINGS(TagAffinity) {
    emscripten::value_object<struct TagAffinity>("TagAffinity")
        .field("id", &TagAffinity::id)
        .field("name", &TagAffinity::name)
        .field("tagId1", &TagAffinity::tagId1)
        .field("tagId2", &TagAffinity::tagId2)
        .field("isPositive", &TagAffinity::isPositive)
        .field("isRequired", &TagAffinity::isRequired)
        .field("counter", &TagAffinity::counter)
    ;

    emscripten::register_vector<struct TagAffinity>("VectorTagAffinity");
    emscripten::register_map<int, struct TagAffinity>("TagAffinityMap");
    emscripten::register_map<int, TagAffinityMap>("TagAffinityMapMap");
}

EMSCRIPTEN_BINDINGS(TagType) {
    emscripten::enum_<TagType>("TagType")
        .value("Custom", TagType::Custom)
        .value("Event", TagType::Event)
        .value("Shift", TagType::Shift)
        .value("Slot", TagType::Slot)
        .value("Worker", TagType::Worker)
    ;
}

EMSCRIPTEN_BINDINGS(Worker) {
    emscripten::register_vector<Worker>("VectorWorker");

    emscripten::value_object<Worker>("Worker")
        .field("id", &Worker::id)
        .field("name", &Worker::name)
        .field("tags", &Worker::tags)
        .field("isActive", &Worker::isActive)
        .field("eventLimit", &Worker::eventLimit)
        .field("eventLimitRequired", &Worker::eventLimitRequired)
        .field("weekLimit", &Worker::weekLimit)
        .field("weekLimitRequired", &Worker::weekLimitRequired)
        .field("monthLimit", &Worker::monthLimit)
        .field("monthLimitRequired", &Worker::monthLimitRequired)
        .field("unavailableDates", &Worker::unavailableDates)
        .field("notes", &Worker::notes)
    ;
}
