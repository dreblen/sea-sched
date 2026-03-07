#pragma once

#include "Common.h"
#include "GradeComponentType.h"

using namespace std;

struct GradeComponent : public Common {
    GradeComponentType id;
    double weight;
};
