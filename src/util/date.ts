/**
 * Converts a date string into a JS Date object while accounting for time zone
 * offset to make sure that the date returned matches the string given.
 * 
 * @param dateString Date as YYYY-MM-DD
 * @returns Corresponding JS Date at midnight local time
 */
export function getNormalizedDate(dateString: string) {
    const buffer = new Date(dateString + 'T00:00:00Z')
    buffer.setMinutes(buffer.getMinutes() + buffer.getTimezoneOffset())
    return buffer
}

/**
 * @param date JS Date to convert. If not specified, the current date will be
 * used instead.
 * @returns Representation of date as YYYY-MM-DD
 */
export function getDateString(date?: Date) {
    if (date === undefined) {
        date = new Date()
    }
    return date.toISOString().split('T')[0] as string
}

/**
 * Extract a list of month and week date ranges from the given base date range.
 * 
 * @param dateStart The first date to consider (inclusive).
 * @param dateEnd The last date to consider (inclusive).
 * @returns Object containing months and weeks arrays with date range strings.
 */
export function getMonthsAndWeeksFromDateRange(dateStart: string, dateEnd: string) {
    const months = [] as { dateStart: string, dateEnd: string }[]
    const weeks = [] as { dateStart: string, dateEnd: string }[]
    
    // Iterate our range and identify weeks and months within it
    const maxDate = getNormalizedDate(dateEnd)
    const bufferDate = getNormalizedDate(dateStart)
    let weekStart = getDateString(bufferDate)
    let monthStart = getDateString(bufferDate)
    while (bufferDate <= maxDate) {
        const dateString = getDateString(bufferDate)
        const tomorrow = getNormalizedDate(dateString)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowString = getDateString(tomorrow)

        // Finish a week?
        if (bufferDate.getDay() === 6) {
            weeks.push({
                dateStart: weekStart,
                dateEnd: dateString
            })
            weekStart = tomorrowString
        }

        // Finish a month?
        if (tomorrow.getDate() === 1) {
            months.push({
                dateStart: monthStart,
                dateEnd: dateString
            })
            monthStart = tomorrowString
        }

        // Prep the next iteration
        bufferDate.setDate(bufferDate.getDate() + 1)
    }

    // Finish out any incomplete weeks or months
    bufferDate.setDate(bufferDate.getDate() - 1)
    const dateString = getDateString(bufferDate)
    if (dateString >= weekStart) {
        weeks.push({
            dateStart: weekStart,
            dateEnd: dateString
        })
    }
    if (dateString >= monthStart) {
        months.push({
            dateStart: monthStart,
            dateEnd: dateString
        })
    }

    return {
        months,
        weeks
    }
}
