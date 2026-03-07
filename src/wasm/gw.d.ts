// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
interface WasmModule {
}

type EmbindString = ArrayBuffer|Uint8Array|Uint8ClampedArray|Int8Array|string;
export interface ClassHandle {
  isAliasOf(other: ClassHandle): boolean;
  delete(): void;
  deleteLater(): this;
  isDeleted(): boolean;
  // @ts-ignore - If targeting lower than ESNext, this symbol might not exist.
  [Symbol.dispose](): void;
  clone(): this;
}
export interface VectorInt extends ClassHandle, Iterable<number> {
  push_back(_0: number): void;
  resize(_0: number, _1: number): void;
  size(): number;
  get(_0: number): number | undefined;
  set(_0: number, _1: number): boolean;
}

export interface VectorString extends ClassHandle, Iterable<string> {
  push_back(_0: EmbindString): void;
  resize(_0: number, _1: EmbindString): void;
  size(): number;
  get(_0: number): string | undefined;
  set(_0: number, _1: EmbindString): boolean;
}

export interface AssignmentAffinityValue<T extends number> {
  value: T;
}
export type AssignmentAffinity = AssignmentAffinityValue<-1>|AssignmentAffinityValue<1>|AssignmentAffinityValue<2>|AssignmentAffinityValue<3>|AssignmentAffinityValue<4>|AssignmentAffinityValue<5>;

export interface AssignmentAffinityTypeValue<T extends number> {
  value: T;
}
export type AssignmentAffinityType = AssignmentAffinityTypeValue<0>|AssignmentAffinityTypeValue<1>|AssignmentAffinityTypeValue<2>;

export type AvailabilityDate = {
  id: number,
  name: EmbindString,
  tags: VectorInt,
  dateStart: EmbindString,
  dateEnd: EmbindString,
  tagLogic: EmbindString,
  notes: EmbindString,
  isRequired: boolean
};

export interface VectorAvailabilityDate extends ClassHandle, Iterable<AvailabilityDate> {
  push_back(_0: AvailabilityDate): void;
  resize(_0: number, _1: AvailabilityDate): void;
  size(): number;
  get(_0: number): AvailabilityDate | undefined;
  set(_0: number, _1: AvailabilityDate): boolean;
}

export type EligibleWorker = {
  workerId: number,
  affinity: AssignmentAffinity,
  affinityNotes: VectorString
};

export interface VectorEligibleWorker extends ClassHandle, Iterable<EligibleWorker> {
  push_back(_0: EligibleWorker): void;
  resize(_0: number, _1: EligibleWorker): void;
  size(): number;
  get(_0: number): EligibleWorker | undefined;
  set(_0: number, _1: EligibleWorker): boolean;
}

export interface VectorGradeComponent extends ClassHandle, Iterable<GradeComponent> {
  size(): number;
  get(_0: number): GradeComponent | undefined;
  push_back(_0: GradeComponent): void;
  resize(_0: number, _1: GradeComponent): void;
  set(_0: number, _1: GradeComponent): boolean;
}

export type GradeComponent = {
  id: GradeComponentType,
  name: EmbindString,
  weight: number
};

export interface GradeComponentTypeValue<T extends number> {
  value: T;
}
export type GradeComponentType = GradeComponentTypeValue<101>|GradeComponentTypeValue<102>|GradeComponentTypeValue<201>|GradeComponentTypeValue<202>|GradeComponentTypeValue<203>|GradeComponentTypeValue<301>|GradeComponentTypeValue<302>|GradeComponentTypeValue<401>;

export interface VectorSchedule extends ClassHandle, Iterable<Schedule> {
  size(): number;
  get(_0: number): Schedule | undefined;
  push_back(_0: Schedule): void;
  resize(_0: number, _1: Schedule): void;
  set(_0: number, _1: Schedule): boolean;
}

export type ScheduleGradeComponent = {
  componentId: GradeComponentType,
  value: number
};

export interface VectorScheduleGradeComponent extends ClassHandle, Iterable<ScheduleGradeComponent> {
  push_back(_0: ScheduleGradeComponent): void;
  resize(_0: number, _1: ScheduleGradeComponent): void;
  size(): number;
  get(_0: number): ScheduleGradeComponent | undefined;
  set(_0: number, _1: ScheduleGradeComponent): boolean;
}

export type ScheduleGrade = {
  overall: number,
  components: VectorScheduleGradeComponent
};

export interface VectorScheduleEvent extends ClassHandle, Iterable<ScheduleEvent> {
  size(): number;
  get(_0: number): ScheduleEvent | undefined;
  push_back(_0: ScheduleEvent): void;
  resize(_0: number, _1: ScheduleEvent): void;
  set(_0: number, _1: ScheduleEvent): boolean;
}

export type Schedule = {
  id: number,
  name: EmbindString,
  events: VectorScheduleEvent,
  grade: ScheduleGrade,
  notesConverted: boolean,
  hash: number
};

export type ScheduleShape = {
  minWeeksBetweenEventShift: number
};

export interface VectorScheduleShift extends ClassHandle, Iterable<ScheduleShift> {
  size(): number;
  get(_0: number): ScheduleShift | undefined;
  push_back(_0: ScheduleShift): void;
  resize(_0: number, _1: ScheduleShift): void;
  set(_0: number, _1: ScheduleShift): boolean;
}

export type ScheduleEvent = {
  id: number,
  name: EmbindString,
  tags: VectorInt,
  calendarDate: EmbindString,
  shifts: VectorScheduleShift
};

export type ScheduleSlot = {
  id: number,
  name: EmbindString,
  tags: VectorInt,
  groupId: number,
  isRequired: boolean,
  workerId: number,
  affinity: AssignmentAffinity,
  affinityNotes: VectorString,
  index: number
};

export interface VectorScheduleSlot extends ClassHandle, Iterable<ScheduleSlot> {
  push_back(_0: ScheduleSlot): void;
  resize(_0: number, _1: ScheduleSlot): void;
  size(): number;
  get(_0: number): ScheduleSlot | undefined;
  set(_0: number, _1: ScheduleSlot): boolean;
}

export type ScheduleShift = {
  id: number,
  name: EmbindString,
  tags: VectorInt,
  slots: VectorScheduleSlot
};

export interface VectorTag extends ClassHandle, Iterable<Tag> {
  size(): number;
  get(_0: number): Tag | undefined;
  push_back(_0: Tag): void;
  resize(_0: number, _1: Tag): void;
  set(_0: number, _1: Tag): boolean;
}

export type TagAffinity = {
  id: number,
  name: EmbindString,
  tagId1: number,
  tagId2: number,
  isPositive: boolean,
  isRequired: boolean,
  counter: number
};

export interface VectorTagAffinity extends ClassHandle, Iterable<TagAffinity> {
  push_back(_0: TagAffinity): void;
  resize(_0: number, _1: TagAffinity): void;
  size(): number;
  get(_0: number): TagAffinity | undefined;
  set(_0: number, _1: TagAffinity): boolean;
}

export interface TagAffinityMap extends ClassHandle {
  size(): number;
  get(_0: number): TagAffinity | undefined;
  set(_0: number, _1: TagAffinity): void;
  keys(): VectorInt;
}

export interface TagAffinityMapMap extends ClassHandle {
  size(): number;
  get(_0: number): TagAffinityMap | undefined;
  set(_0: number, _1: TagAffinityMap): void;
  keys(): VectorInt;
}

export type Tag = {
  id: number,
  name: EmbindString,
  type: TagType
};

export interface TagTypeValue<T extends number> {
  value: T;
}
export type TagType = TagTypeValue<1>|TagTypeValue<2>|TagTypeValue<3>|TagTypeValue<4>|TagTypeValue<5>;

export interface VectorWorker extends ClassHandle, Iterable<Worker> {
  size(): number;
  get(_0: number): Worker | undefined;
  push_back(_0: Worker): void;
  resize(_0: number, _1: Worker): void;
  set(_0: number, _1: Worker): boolean;
}

export type Worker = {
  id: number,
  name: EmbindString,
  tags: VectorInt,
  isActive: boolean,
  eventLimit: number,
  eventLimitRequired: boolean,
  weekLimit: number,
  weekLimitRequired: boolean,
  monthLimit: number,
  monthLimitRequired: boolean,
  unavailableDates: VectorAvailabilityDate,
  notes: EmbindString
};

interface EmbindModule {
  VectorInt: {
    new(): VectorInt;
  };
  VectorString: {
    new(): VectorString;
  };
  AssignmentAffinity: {Undefined: AssignmentAffinityValue<-1>, Required: AssignmentAffinityValue<1>, Preferred: AssignmentAffinityValue<2>, Neutral: AssignmentAffinityValue<3>, Unwanted: AssignmentAffinityValue<4>, Disallowed: AssignmentAffinityValue<5>};
  AssignmentAffinityType: {Negative: AssignmentAffinityTypeValue<0>, Neutral: AssignmentAffinityTypeValue<1>, Positive: AssignmentAffinityTypeValue<2>};
  VectorAvailabilityDate: {
    new(): VectorAvailabilityDate;
  };
  VectorEligibleWorker: {
    new(): VectorEligibleWorker;
  };
  VectorGradeComponent: {
    new(): VectorGradeComponent;
  };
  GradeComponentType: {SlotCoverageRequired: GradeComponentTypeValue<101>, SlotCoverageOptional: GradeComponentTypeValue<102>, BalanceCount: GradeComponentTypeValue<201>, BalanceSpacing: GradeComponentTypeValue<202>, BalanceDistribution: GradeComponentTypeValue<203>, VarietyAssignments: GradeComponentTypeValue<301>, VarietyCoworkers: GradeComponentTypeValue<302>, TagAffinity: GradeComponentTypeValue<401>};
  VectorSchedule: {
    new(): VectorSchedule;
  };
  VectorScheduleGradeComponent: {
    new(): VectorScheduleGradeComponent;
  };
  VectorScheduleEvent: {
    new(): VectorScheduleEvent;
  };
  VectorScheduleShift: {
    new(): VectorScheduleShift;
  };
  VectorScheduleSlot: {
    new(): VectorScheduleSlot;
  };
  VectorTag: {
    new(): VectorTag;
  };
  VectorTagAffinity: {
    new(): VectorTagAffinity;
  };
  TagAffinityMap: {
    new(): TagAffinityMap;
  };
  TagAffinityMapMap: {
    new(): TagAffinityMapMap;
  };
  TagType: {Custom: TagTypeValue<1>, Event: TagTypeValue<2>, Shift: TagTypeValue<3>, Slot: TagTypeValue<4>, Worker: TagTypeValue<5>};
  VectorWorker: {
    new(): VectorWorker;
  };
  generateSchedules(_0: (a: number) => void, _1: bigint, _2: VectorScheduleEvent, _3: VectorWorker, _4: VectorTag, _5: VectorTagAffinity, _6: TagAffinityMapMap, _7: VectorGradeComponent, _8: ScheduleShape, _9: boolean, _10: bigint, _11: number, _12: number): VectorSchedule;
}

export type MainModule = WasmModule & EmbindModule;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
