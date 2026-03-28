import { useAuth } from '../context/AuthContext.jsx';
import { normalizeWeightUnit } from '../utils/weightUnits.js';

/** User preference for displaying weights; default kg. */
export function useWeightUnit() {
  const { user } = useAuth();
  return normalizeWeightUnit(user?.weightUnit);
}
