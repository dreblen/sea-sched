#pragma once

enum class AssignmentAffinity {
    Undefined = -1,
    Required = 1,
    Preferred = 2,
    Neutral = 3,
    Unwanted = 4,
    Disallowed = 5,
};
