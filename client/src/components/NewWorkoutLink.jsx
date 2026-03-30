import { Link } from 'react-router-dom';
import { appPath } from '../constants/routes.js';
import { resetNewWorkoutDraftSession } from '../utils/workoutDraftStorage.js';

/**
 * Starts a fresh unsaved-workout draft session so abandoned "new workout" data
 * does not reappear after the user opens another new workout from the list.
 */
export default function NewWorkoutLink({ className, children, ...rest }) {
  return (
    <Link
      to={appPath('workouts/new')}
      className={className}
      onClick={() => resetNewWorkoutDraftSession()}
      {...rest}
    >
      {children}
    </Link>
  );
}
