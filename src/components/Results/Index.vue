<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { Schedule, ScheduleEvent, ScheduleMonth, ScheduleWeek, ScopeSegment } from '@/types'
import { AssignmentAffinity, AssignmentAffinityType } from '@/types'

import { useSetupStore } from '@/stores/setup'
import { useParametersStore } from '@/stores/parameters'
import { useResultsStore } from '@/stores/results'

import * as util from '@/util'

import ListToDetail from '../ListToDetail.vue'

const router = useRouter()

const setup = useSetupStore()
const parameters = useParametersStore()
const results = useResultsStore()

function getColorForGrade(gradeValue?: number) {
    if (gradeValue === undefined) {
        return
    } else if (gradeValue >= 90) {
        return 'success'
    } else if (gradeValue >= 70) {
        return 'warning'
    } else {
        return 'error'
    }
}

function getAssignmentAffinityProps(workerId?: number, value?: AssignmentAffinity) {
    // If there is no assignment, we display strongly negative results
    if (workerId === undefined || workerId === 0) {
        return ['error','mdi-alert-octagon']
    }

    // Otherwise, we use the actual affinity values
    const type = util.getAssignmentAffinityType(value)
    switch (type) {
        case AssignmentAffinityType.Positive:
            return ['success','mdi-check-circle']
        case AssignmentAffinityType.Negative:
            return ['warning','mdi-alert']
        default:
            return []
    }
}

const uniqueShiftNames = computed(() => {
    const names = [] as string[]
    
    if (results.schedules.length > 0) {
        for (const event of (results.schedules[0] as Schedule).events) {
            for (const shift of event.shifts) {
                if (!names.includes(shift.name)) {
                    names.push(shift.name)
                }
            }
        }
    }

    return names
})

const selectedScheduleSteps = ref<number[]>([])

function onCurrentScheduleChange(id?: number) {
    // No matter what, clear out any step selection
    selectedScheduleSteps.value = []

    // Try to find the new schedule to work with
    const schedule = results.schedules.find((s) => s.id === id)
    if (schedule === undefined) {
        updateCurrentStepData(null)
        return
    }

    updateCurrentStepData(schedule)

    // Make sure this schedule has had its tag-related affinity notes converted
    // from IDs into names. We don't do this in bulk to improve performance when
    // results are returned from the generation worker.
    if (schedule.notesConverted === true) {
        return
    }

    for (const event of schedule.events) {
        for (const shift of event.shifts) {
            for (const slot of shift.slots) {
                if (slot.affinityNotes === undefined) {
                    continue
                }

                for (const i in slot.affinityNotes) {
                    const currentNote = slot.affinityNotes[i] as string

                    // Test if this is a tag affinity note
                    const parts = currentNote.split('|')
                    if (parts.length !== 2) {
                        continue
                    }
                    const id1 = parseInt(parts[0] as string)
                    const id2 = parseInt(parts[1] as string)
                    if (isNaN(id1) || isNaN(id2)) {
                        continue
                    }

                    // Look up the tag names and build a new note
                    const tag1 = results.tags.find((t) => t.id === id1)
                    const tag2 = results.tags.find((t) => t.id === id2)
                    slot.affinityNotes[i] = `"${tag1?.name}" / "${tag2?.name}"`
                }
            }
        }
    }

    schedule.notesConverted = true
}

function getScheduleByMonthAndWeek(schedule: Schedule) {
    // Gather data about events grouped by week
    const eventsByWeek = {} as { [weekId: number]: ScheduleEvent[] }
    for (const event of schedule.events) {
        const targetWeek = results.weeks.find((w) => event.calendarDate >= w.dateStart && event.calendarDate <= w.dateEnd) as ScopeSegment
        if (eventsByWeek[targetWeek.id] === undefined) {
            eventsByWeek[targetWeek.id] = []
        }

        eventsByWeek[targetWeek.id]?.push(event)
    }

    // Gather data about weeks grouped by month
    const weeksByMonth = {} as { [monthId: number]: number[] }
    for (const weekId of Object.keys(eventsByWeek)) {
        const week = results.weeks.find((w) => w.id === parseInt(weekId)) as ScopeSegment
        const targetMonth = results.months.find((m) => week.dateStart >= m.dateStart && week.dateStart <= m.dateEnd) as ScopeSegment
        if (weeksByMonth[targetMonth.id] === undefined) {
            weeksByMonth[targetMonth.id] = []
        }

        weeksByMonth[targetMonth.id]?.push(week.id)
    }

    // Build our final schedule segments now that we have full context
    const months = [] as ScheduleMonth[]
    for (const monthId of Object.keys(weeksByMonth)) {
        const month = results.months.find((m) => m.id === parseInt(monthId)) as ScopeSegment
        const newMonth: ScheduleMonth = {
            id: month.id,
            name: month.name,
            dateStart: month.dateStart,
            dateEnd: month.dateEnd,
            tags: month.tags.slice(),
            weeks: []
        }

        for (const weekId of (weeksByMonth[parseInt(monthId)] as number[])) {
            const week = results.weeks.find((w) => w.id === weekId) as ScopeSegment
            const events = eventsByWeek[weekId] as ScheduleEvent[]
            const newWeek: ScheduleWeek = {
                id: week.id,
                name: week.name,
                dateStart: week.dateStart,
                dateEnd: week.dateEnd,
                tags: week.tags.slice(),
                events
            }

            newMonth.weeks.push(newWeek)
        }

        months.push(newMonth)
    }

    return months
}

function getNumAssignmentsForWorker(schedule: Schedule, calendarDate: string, workerId?: number) {
    // Define a function that can be used to reduce a list of schedule events
    // into the number of assignments for the specified worker in that list
    const eventReducer = (t: number, e: ScheduleEvent) =>
        t + e.shifts.reduce(
            (t, s) => t + s.slots.reduce(
                (t, l) => t + (l.workerId === workerId ? 1 : 0),0
            ),0
        )
    
    // Get the number of assignments in total, by month, and by week
    const total = schedule.events.reduce(eventReducer,0)

    const targetMonth = results.months.find((m) => calendarDate >= m.dateStart && calendarDate <= m.dateEnd) as ScopeSegment
    const inMonth = schedule.events
        .filter((e) => e.calendarDate >= targetMonth.dateStart && e.calendarDate <= targetMonth.dateEnd)
        .reduce(eventReducer,0)

    const targetWeek = results.weeks.find((w) => calendarDate >= w.dateStart && calendarDate <= w.dateEnd) as ScopeSegment
    const inWeek = schedule.events
        .filter((e) => e.calendarDate >= targetWeek.dateStart && e.calendarDate <= targetWeek.dateEnd)
        .reduce(eventReducer,0)

    return `${total} / ${inMonth} / ${inWeek}`
}

function onShiftMouseEnterOrLeave(type: 'enter'|'leave', monthId: number, weekId: number) {
    const monthRows = document.getElementsByClassName(`month-${monthId}`)
    const weekRows = document.getElementsByClassName(`week-${weekId}`)
    for (const row of monthRows) {
        let targetValue = (type === 'enter') ? '#def' : '';
        (row as HTMLElement).style.backgroundColor = targetValue
    }
    for (const row of weekRows) {
        let targetValue = (type === 'enter') ? '#ffc' : '';
        (row as HTMLElement).style.backgroundColor = targetValue
    }
}

function onWorkerNameMouseEnterOrLeave(type: 'enter'|'leave', workerId?: number) {
    if (workerId === undefined) {
        return
    }

    const workerSlots = document.getElementsByClassName(`worker-${workerId}`)
    for (const slot of workerSlots) {
        let targetValue = (type === 'enter') ? '#ff0' : '';
        (slot as HTMLElement).style.backgroundColor = targetValue
    }
}

const currentScheduleStepIds = ref<number[]>([])
const currentScheduleStepCount = computed(() => currentScheduleStepIds.value?.length)
const areAllScheduleStepsSelected = computed(() => selectedScheduleSteps.value.length === currentScheduleStepCount.value)
const isScheduleStepSelectionIndeterminate = computed(() => areAllScheduleStepsSelected.value === false && selectedScheduleSteps.value.length > 0)

function populateScheduleSteps(id: number) {
    const schedule = results.schedules.find((s) => s.id === id)
    if (schedule === undefined) {
        return
    }

    if (schedule.steps.length > 0) {
        return
    }

    // Generate schedule steps from the schedule's slot index values
    let newId = 1
    for (const event of schedule.events) {
        for (const shift of event.shifts) {
            for (const slot of shift.slots) {
                const worker = setup.workers.find((w) => w.id === slot.workerId)

                schedule.steps.push({
                    id: newId++,
                    name: `${(slot.index as number) + 1}. ${event.name}: ${shift.name} - ${slot.name} - ${worker?.name || 'N/A'}`,
                    sequence: slot.index as number,
                    eventId: event.id,
                    shiftId: shift.id,
                    slotId: slot.id,
                    workerId: slot.workerId
                })
            }
        }
    }

    // Sort the results so they appear in the proper sequence order
    schedule.steps.sort((a,b) => {
        if (a.sequence < b.sequence) {
            return -1
        }
        if (a.sequence > b.sequence) {
            return 1
        }
        return 0
    })

    updateCurrentStepData(schedule)
}

function updateCurrentStepData(schedule: Schedule|null) {
    if (schedule === null) {
        currentScheduleStepIds.value = []
    } else {
        currentScheduleStepIds.value = schedule.steps.map((s) => s.id)
    }
}

function onToggleSelectAllScheduleSteps(newValue: boolean|null) {
    if (newValue === true) {
        selectedScheduleSteps.value = currentScheduleStepIds.value
    } else {
        selectedScheduleSteps.value = []
    }
}

function onUseStepsForNewSchedule(schedule: Schedule) {
    // If there are no selected steps, it shouldn't be possible to call this
    // method, and there's nothing to do
    if (selectedScheduleSteps.value.length === 0) {
        return
    }

    // Get a flat version of the reference schedule so we can find slots easily
    // based on step IDs
    const gss = util.newGenerationSlots(schedule.events)

    // Get a version of this schedule with only the slot assignments from the
    // selected generation steps
    const newSchedule = util.newSchedule(schedule.events)
    const newGss = util.newGenerationSlots(newSchedule.events)
    for (const step of schedule.steps.filter((s) => selectedScheduleSteps.value.includes(s.id))) {
        const gs = gss.find((gs) => gs.event.id === step.eventId && gs.shift.id === step.shiftId && gs.slot.id === step.slotId)
        const newGs = newGss.find((gs) => gs.event.id === step.eventId && gs.shift.id === step.shiftId && gs.slot.id === step.slotId)
        if (gs === undefined || newGs === undefined) {
            continue
        }

        newGs.slot.workerId = gs.slot.workerId
        newGs.slot.affinity = gs.slot.affinity
        newGs.slot.affinityNotes = gs.slot.affinityNotes
    }

    // Save our new schedule to the parameters store so it can be referenced for
    // new schedule generations
    parameters.baseSchedule = newSchedule
    router.push('/parameters')
}
</script>

<template>
    <list-to-detail :items="results.schedules" :no-actions="true" @change="onCurrentScheduleChange">
        <template #default="{ item: schedule }">
            <template v-if="!schedule">
                No schedule currently selected.
            </template>
            <template v-else>
                <v-container>
                    <v-row>
                        <v-col>
                            <v-expansion-panels>
                                <v-expansion-panel>
                                    <v-expansion-panel-title>
                                        <v-chip :color="getColorForGrade((schedule as Schedule).grade?.overall)">
                                            {{ (schedule as Schedule).grade?.overall }}
                                        </v-chip>
                                        Grade Details...
                                    </v-expansion-panel-title>
                                    <v-expansion-panel-text>
                                        <v-row v-for="component of (schedule as Schedule).grade?.components" :key="component.componentId">
                                            <v-col cols="4" sm="2" lg="1">
                                                <v-chip density="compact" :color="getColorForGrade(component.value)">
                                                    {{ component.value }}
                                                </v-chip>
                                            </v-col>
                                            <v-col v-for="componentDefinition of results.gradeComponents.filter((gc) => gc.id === component.componentId)">
                                                {{ componentDefinition.name }} (Weight = {{ componentDefinition.weight }}%)
                                            </v-col>
                                        </v-row>
                                    </v-expansion-panel-text>
                                </v-expansion-panel>
                            </v-expansion-panels>
                        </v-col>
                    </v-row>
                    <v-row>
                        <v-col>
                            <v-table>
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Event</th>
                                        <th v-for="name in uniqueShiftNames" :key="name">
                                            {{ name }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <template v-for="month in getScheduleByMonthAndWeek((schedule as Schedule))" :key="month.id">
                                        <template v-for="(week, i) in month.weeks" :key="week.id">
                                            <tr
                                                v-for="(event, j) in week.events"
                                                :key="event.id"
                                                :class="`month-${month.id}`"
                                            >
                                                <td
                                                    v-if="i === 0 && j === 0"
                                                    :rowspan="month.weeks.reduce((t,v) => t + v.events.length,0)"
                                                >
                                                    <span style="transform: rotate(-90deg); display: block">
                                                        {{ month.name.replace(' ','&nbsp;') }}
                                                    </span>
                                                </td>
                                                <td
                                                    @mouseenter="onShiftMouseEnterOrLeave('enter',month.id, week.id)"
                                                    @mouseleave="onShiftMouseEnterOrLeave('leave',month.id, week.id)"
                                                    :class="[`month-${month.id}`,`week-${week.id}`]"
                                                >
                                                    {{ event.name }}
                                                </td>
                                                <td
                                                    v-for="name in uniqueShiftNames"
                                                    :key="name"
                                                    @mouseenter="onShiftMouseEnterOrLeave('enter',month.id, week.id)"
                                                    @mouseleave="onShiftMouseEnterOrLeave('leave',month.id, week.id)"
                                                    :class="[`month-${month.id}`,`week-${week.id}`]"
                                                >
                                                    <p v-for="slot in event.shifts.find((s) => s.name === name)?.slots" :key="slot.id">
                                                        <span v-for="step in (schedule as Schedule).steps.filter((s) => s.sequence === slot.index)">
                                                            <v-icon v-if="selectedScheduleSteps.includes(step.id)">mdi-checkbox-outline</v-icon>
                                                        </span>
                                                        {{ slot.name }}:
                                                        <v-hover v-slot="{ isHovering, props }">
                                                            <v-tooltip
                                                                v-if="slot.affinity !== AssignmentAffinity.Neutral"
                                                                :text="slot.affinityNotes ? slot.affinityNotes.join(', ') : 'No notes'"
                                                                location="top"
                                                            >
                                                                <template #activator="{ props: tooltipProps }">
                                                                    <v-icon
                                                                        v-bind="tooltipProps"
                                                                        :color="getAssignmentAffinityProps(slot.workerId, slot.affinity)[0]"
                                                                    >
                                                                        {{ getAssignmentAffinityProps(slot.workerId, slot.affinity)[1] }}
                                                                    </v-icon>
                                                                </template>
                                                            </v-tooltip>
                                                            <span v-bind="props">
                                                                <span
                                                                    :class="`worker-${slot.workerId}`"
                                                                    @mouseenter="onWorkerNameMouseEnterOrLeave('enter',slot.workerId)"
                                                                    @mouseleave="onWorkerNameMouseEnterOrLeave('leave',slot.workerId)"
                                                                >
                                                                    {{ setup.workers.find((w) => w.id === slot.workerId)?.name || 'N/A' }}
                                                                </span>
                                                                <template v-if="isHovering">
                                                                    <v-chip size="small" density="compact">
                                                                        {{ getNumAssignmentsForWorker(schedule as Schedule, event.calendarDate, slot.workerId) }}
                                                                    </v-chip>
                                                                </template>
                                                                <template v-else>
                                                                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                                                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                                                </template>
                                                            </span>
                                                        </v-hover>
                                                    </p>
                                                </td>
                                            </tr>
                                        </template>
                                    </template>
                                </tbody>
                            </v-table>
                        </v-col>
                    </v-row>
                    <v-row>
                        <v-col cols="12">
                            <h1 class="text-h4">Generation Steps</h1>
                        </v-col>
                        <v-col v-if="(schedule as Schedule).steps.length === 0">
                            <v-btn
                                @click="populateScheduleSteps(schedule.id)"
                                color="primary"
                            >
                                Load Step Data
                            </v-btn>
                        </v-col>
                        <v-col v-else cols="12">
                            <v-card variant="outlined">
                                <v-card-actions>
                                    <v-row>
                                        <v-col class="pb-0" cols="12">
                                            <v-checkbox
                                                label="Select All/None"
                                                hide-details
                                                :model-value="areAllScheduleStepsSelected"
                                                :indeterminate="isScheduleStepSelectionIndeterminate"
                                                @update:model-value="onToggleSelectAllScheduleSteps"
                                            />
                                        </v-col>
                                    </v-row>
                                </v-card-actions>
                                <v-list
                                    v-model:selected="selectedScheduleSteps"
                                    select-strategy="independent"
                                    max-height="250px"
                                    style="overflow-y: scroll"
                                >
                                    <v-list-item
                                        v-for="step in (schedule as Schedule).steps"
                                        :key="step.id"
                                        :title="step.name"
                                        :value="step.id"
                                    >
                                        <template #prepend="{ isSelected, select }">
                                            <v-checkbox-btn
                                                :model-value="isSelected"
                                                @update:model-value="select"
                                            />
                                        </template>
                                    </v-list-item>
                                </v-list>
                                <v-card-actions>
                                    <v-row>
                                        <v-col>
                                            <v-btn
                                                @click="onUseStepsForNewSchedule(schedule as Schedule)"
                                                :disabled="selectedScheduleSteps.length === 0"
                                                color="primary"
                                            >
                                                Use Selected Steps for a New Schedule...
                                            </v-btn>
                                        </v-col>
                                    </v-row>
                                </v-card-actions>
                            </v-card>
                        </v-col>
                    </v-row>
                    <v-row>
                        <v-col>
                            <span class="text-caption">
                                Reference #{{ (schedule as Schedule).hash }}
                            </span>
                        </v-col>
                    </v-row>
                </v-container>
            </template>
        </template>
        <template #append="{ item }">
            <v-chip :color="getColorForGrade((item as Schedule).grade?.overall)">
                {{ (item as Schedule).grade?.overall }}
            </v-chip>
        </template>
        <template #appendActions>
            <v-dialog max-width="500px">
                <template #activator="{ props }">
                    <v-btn
                        v-bind="props"
                        block
                        color="warning"
                    >
                        Regrade
                    </v-btn>
                </template>
                <template #default="{ isActive }">
                    <v-card>
                        <v-card-text>
                            If configuration values have been changed since the
                            time the schedules were generated (e.g., workers,
                            tag relationships), the new grades will reflect the
                            current values for those as well as the current
                            grade weights. Do you want to regrade the schedules?
                        </v-card-text>
                        <v-card-actions>
                            <v-btn @click="isActive.value = false">No</v-btn>
                            <v-btn color="warning" @click="results.regradeSchedules(); isActive.value = false">Yes</v-btn>
                        </v-card-actions>
                    </v-card>
                </template>
            </v-dialog>
        </template>
    </list-to-detail>
</template>
