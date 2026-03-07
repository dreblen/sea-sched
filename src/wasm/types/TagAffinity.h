#pragma once

#include <map>

#include "Common.h"

using namespace std;

struct TagAffinity : public Common {
    int tagId1;
    int tagId2;
    bool isPositive;
    bool isRequired;
    int counter;
};

typedef map<int, struct TagAffinity> TagAffinityMap;

typedef map<int, TagAffinityMap> TagAffinityMapMap;
