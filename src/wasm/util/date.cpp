#include <ctime>
#include <iomanip>
#include <sstream>

#include "date.h"

using namespace std;

time_t getNormalizedTimestamp(string dateString) {
    tm buffer = {};
    istringstream ss(dateString);
    ss >> get_time(&buffer, "%Y-%m-%d");
    if (ss.fail()) {
        return -1;
    }
    
    return mktime(&buffer);
}

string getDateString(time_t timestamp) {
    if (timestamp == 0) {
        time(&timestamp);
    }

    tm* buffer = gmtime(&timestamp);
    ostringstream ss;
    ss << put_time(buffer, "%Y-%m-%d");

    return ss.str();
}

MonthAndWeekRanges getMonthsAndWeeksFromDateRange(string dateStart, string dateEnd) {
    MonthAndWeekRanges results;

    // Iterate our range and identify weeks and months within it
    const time_t maxDate = getNormalizedTimestamp(dateEnd);
    time_t bufferTs = getNormalizedTimestamp(dateStart);
    string weekStart = getDateString(bufferTs);
    string monthStart = weekStart;
    while (bufferTs <= maxDate) {
        const tm* bufferDate = gmtime(&bufferTs);
        const string dateString = getDateString(bufferTs);
        const time_t tomorrowTs = bufferTs + (60 * 60 * 24);
        const tm* tomorrowDate = gmtime(&tomorrowTs);
        const string tomorrowString = getDateString(tomorrowTs);

        // Finish a week?
        if (bufferDate->tm_wday == 6) {
            DateRange week;
            week.dateStart = weekStart;
            week.dateEnd = dateString;
            results.weeks.push_back(week);

            weekStart = tomorrowString;
        }

        // Finish a month?
        if (tomorrowDate->tm_mday == 1) {
            DateRange month;
            month.dateStart = monthStart;
            month.dateEnd = dateString;
            results.months.push_back(month);

            monthStart = tomorrowString;
        }

        // Prep the next iteration
        bufferTs = tomorrowTs;
    }

    // Finish out any incomplete weeks or months
    bufferTs -= (60 * 60 * 24);
    const string dateString = getDateString(bufferTs);
    if (dateString >= weekStart) {
        DateRange week;
        week.dateStart = weekStart;
        week.dateEnd = dateString;
        results.weeks.push_back(week);
    }
    if (dateString >= monthStart) {
        DateRange month;
        month.dateStart = monthStart;
        month.dateEnd = dateString;
        results.months.push_back(month);
    }

    return results;
}
