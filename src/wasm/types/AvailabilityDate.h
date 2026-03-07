#pragma once

#include "Tagged.h"

using namespace std;

struct AvailabilityDate : public Tagged {
    string dateStart;
    string dateEnd;
    string tagLogic;
    string notes;
    bool isRequired;
};
