/** Hevy CSV row after normalization (one line per set). */
export interface HevyCsvRow {
  workoutTitle: string;
  startTime: Date;
  endTime: Date | null;
  exerciseName: string;
  weightKg: number;
  reps: number;
  setOrder: number;
  setType: 'warmup' | 'normal' | 'failure';
}

/** One exercise block inside a grouped workout. */
export interface HevyGroupedExercise {
  name: string;
  order: number;
  sets: Array<{
    reps: number;
    weight: number;
    completed: boolean;
    setType: 'warmup' | 'normal' | 'failure';
    order: number;
  }>;
}

/** Grouped workout ready for persistence. */
export interface HevyGroupedWorkout {
  title: string;
  startedAt: Date;
  completedAt: Date | null;
  exercises: HevyGroupedExercise[];
  durationMinutes: number | null;
}
