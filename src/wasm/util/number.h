#pragma once

#include <vector>
#include <type_traits>

using namespace std;

#ifndef u_int64_t
typedef unsigned long long u_int64_t;
#endif

template <typename T>
double getStandardDeviation(const vector<T>& valueList);

vector<int> getBase10toBaseX(u_int64_t original, int base, int arrayPadding = 0);
