#include <vector>
#include <stdexcept>
#include <cmath>

#include "number.h"

using namespace std;

template <typename T>
double getStandardDeviation(const vector<T>& valueList) {
    double total = 0;
    for (const T val : valueList) {
        total += val;
    }
    double avgValue = total / valueList.size();

    double deviationTotal = 0;
    for (const T val : valueList) {
        deviationTotal += pow(val - avgValue,2);
    }
    double variance = deviationTotal / valueList.size();

    return sqrt(variance);
}

// Explicit instantiation so these don't get lost in linking
template double getStandardDeviation<int>(const vector<int>& valueList);
template double getStandardDeviation<double>(const vector<double>& valueList);

vector<int> getBase10toBaseX(u_int64_t original, int base, int arrayPadding) {
    // Stop short if we have an invalid base. This shouldn't ever occur in the
    // way we call this method, but the check is here to prevent an infinite
    // loop if it does for some reason.
    if (base < 2) {
        throw new range_error("Base must be >= 2");
    }

    // Determine the highest power we need to work with
    int topPower = 0;
    for (int i = 0; ; i++) {
        if (pow(base, i) > original) {
            topPower = i - 1;
            break;
        }
    }

    // Iterate down from the highest power, reducing our accumulator
    vector<int> results;
    u_int64_t balance = original;
    for (int i = topPower; i >= 0; i--) {
        for (int j = 0; j < base; j++) {
            // If this power is higher than the remaining balance on its own,
            // skip it and move down
            if (pow(base, i) > balance) {
                results.push_back(0);
                break;
            }

            // Otherwise, calculat our limit within this power
            u_int64_t p = j * pow(base, i);

            if (p > balance) {
                results.push_back(j - 1);
                balance -= (j - 1) * pow(base, i);
                break;
            } else if (j == (base - 1)) {
                results.push_back(j);
                balance -= p;
                break;
            }
        }
    }

    // Pad the results as needed
    if (arrayPadding > 0) {
        int diff = arrayPadding - results.size();
        for (int i = 0; i < diff; i++) {
            results.insert(results.begin(), 0);
        }
    }

    return results;
}
