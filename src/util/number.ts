/**
 * Converts a number into a representational string that condenses larger values
 * with a unit indicator (e.g., 10K, 100M, 1B). Any number larger than the
 * highest usable threshold will be converted to a one-decimal-precision
 * scientific (or E) notation version.
 * 
 * @param value The number to convert.
 * @returns String value as described.
 */
export function getLargeNumberDisplayForm(value: number): string {
    const summaryThresholds = [
        { power: 3, append: 'K' },
        { power: 6, append: 'M' },
        { power: 9, append: 'B' },
        { power: 12, append: 'T' },
        { power: 15, append: '' },
    ]

    // Find the largest power increment that this value matches
    let power = 0
    for (const threshold of summaryThresholds) {
        if (value >= Math.pow(10,threshold.power)) {
            power = threshold.power
        }
    }

    // Summarize the number into that power's format
    const threshold = summaryThresholds.find((t) => t.power === power)
    if (threshold === undefined) {
        // If we didn't pass even the lowest threshold, we can use the
        // number as is
        return value.toString()
    }

    // The special case of the highest power gets treated with E notation
    if (threshold.append === '') {
        return value.toExponential(1)
    }

    // Normal scenario divides by the power value and adds the symbol
    const divided = value / Math.pow(10,threshold.power)
    const rounded = Math.round(divided * 10) / 10
    return `${rounded}${threshold.append}`
}

/**
 * @param valueList Array of numbers to calculate against.
 * @returns The standard deviation of the input list.
 */
export function getStandardDeviation(valueList: number[]) {
    const avgValue = valueList.reduce((t,v) => t+v,0.0) / valueList.length
    const deviations = valueList.map((v) => Math.pow(v - avgValue,2))
    const numAssignmentVariance = deviations.reduce((t,v) => t+v,0.0) / deviations.length
    return Math.sqrt(numAssignmentVariance)
}

/**
 * Convert a base-10 number into an array of digits representing a number of an
 * arbitrary base. Example: original = 10, base = 2 returns [1,0,1,0]. This is
 * used for comprehensive schedule generation to convert a single seed number
 * into usable slot assignments.
 * 
 * @param original Number to convert (base 10 by JS default).
 * @param base The target numerical base to convert into.
 * @param arrayPadding If specified, the result will be zero-padded to this
 * length if needed.
 * @returns Array of base-10 numbers representing values for the specified base
 * (e.g., if converting to base 16, "10" will be 10 and not A). These are
 * ordered so the first index is the highest power and the last index is the
 * lowest power, matching common visual representation of number systems and not
 * the logical association of "lowest index" = "lowest power."
 */
export function getBase10toBaseX(original: number, base: number, arrayPadding?: number) {
    // Determine the highest power we need to work with
    let topPower = 0
    for (let i = 0; ; i++) {
        if (Math.pow(base, i) > original) {
            topPower = i - 1
            break
        }
    }

    // Iterate down from the highest power, reducing our accumulator
    const results = [] as number[]
    let balance = original
    for (let i = topPower; i >= 0; i--) {
        for (let j = 0; j < base; j++) {
            // If this power is higher than the remaining balance on its own,
            // skip it and move down
            if (Math.pow(base, i) > balance) {
                results.push(0)
                break
            }

            // Otherwise, calculat our limit within this power
            const p = j * Math.pow(base, i)

            if (p > balance) {
                results.push(j - 1)
                balance -= (j - 1) * Math.pow(base, i)
                break
            } else if (j === base - 1) {
                results.push(j)
                balance -= p
                break
            }
        }
    }

    // Pad the results as needed
    if (arrayPadding !== undefined) {
        const diff = arrayPadding - results.length
        for (let i = 0; i < diff; i++) {
            results.unshift(0)
        }
    }

    return results
}
