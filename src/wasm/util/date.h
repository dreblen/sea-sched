#pragma once

#include <string>
#include <vector>

using namespace std;

struct DateRange {
    string dateStart;
    string dateEnd;
};

struct MonthAndWeekRanges {
    vector<DateRange> months;
    vector<DateRange> weeks;
};

time_t getNormalizedTimestamp(string dateString);

string getDateString(time_t timestamp);

MonthAndWeekRanges getMonthsAndWeeksFromDateRange(string dateStart, string dateEnd);
