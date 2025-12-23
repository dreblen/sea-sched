// Given a string in the format of YYYY-MM-DD, return a JS Date object for
// that date at midnight local time, to avoid skewing issues
export function getNormalizedDate(dateString: string) {
    const buffer = new Date(dateString + 'T00:00:00Z')
    buffer.setMinutes(buffer.getMinutes() + buffer.getTimezoneOffset())
    return buffer
}

// Given a JS Date object, return a string representing it as YYYY-MM-DD
export function getDateString(date?: Date) {
    if (date === undefined) {
        date = new Date()
    }
    return date.toISOString().split('T')[0] as string
}
