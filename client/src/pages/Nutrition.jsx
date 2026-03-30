import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Library,
  Pencil,
  Plus,
  ScanBarcode,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import api from '../api/client.js';
import BarcodeScannerModal from '../components/nutrition/BarcodeScannerModal.jsx';
import { appAlert, appConfirm } from '../lib/appDialogApi.js';
import {
  dayKeyInBucharest,
  formatDayKeyDisplay,
  shiftDayKey,
} from '../utils/nutritionDayKey.js';
import {
  previewFromPer100g,
  progressPct,
  roundCal,
  roundMacro,
  safeNonNeg,
} from '../utils/nutritionCompute.js';

const CARD =
  'rounded-xl border border-slate-800/90 bg-[#121826]/95 p-4 shadow-sm shadow-black/20 sm:p-5';
const FIELD =
  'w-full min-w-0 rounded-lg border border-slate-700 bg-surface px-3 py-2.5 text-[15px] text-white placeholder:text-slate-500';
const BTN_PRIMARY =
  'inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const BTN_GHOST =
  'inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-lg border border-slate-700 bg-slate-800/40 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800/70 active:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];
const MEAL_LABEL = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  other: 'Uncategorized',
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const EMPTY_LIBRARY_FORM = {
  name: '',
  brand: '',
  barcode: '',
  caloriesPer100g: '',
  proteinPer100g: '',
  carbsPer100g: '',
  fatsPer100g: '',
  fiberPer100g: '',
  sugarPer100g: '',
  servingLabel: '',
  servingGrams: '',
};

function pickRowToLibraryForm(row, barcodeExtra = '') {
  const ext = row?.externalId != null ? String(row.externalId) : '';
  const barcodeFromExt = /^\d{8,14}$/.test(ext) ? ext : '';
  return {
    name: row?.name || '',
    brand: row?.brand || '',
    barcode: String(barcodeExtra || row?.barcode || barcodeFromExt || ''),
    caloriesPer100g: row?.caloriesPer100g != null ? String(row.caloriesPer100g) : '',
    proteinPer100g: row?.proteinPer100g != null ? String(row.proteinPer100g) : '',
    carbsPer100g: row?.carbsPer100g != null ? String(row.carbsPer100g) : '',
    fatsPer100g: row?.fatsPer100g != null ? String(row.fatsPer100g) : '',
    fiberPer100g: row?.fiberPer100g != null ? String(row.fiberPer100g) : '',
    sugarPer100g: row?.sugarPer100g != null ? String(row.sugarPer100g) : '',
    servingLabel: row?.servingLabel != null ? String(row.servingLabel) : '',
    servingGrams: row?.servingGrams != null ? String(row.servingGrams) : '',
  };
}

function groupFoods(foods) {
  const m = { breakfast: [], lunch: [], dinner: [], snack: [], other: [] };
  for (const f of foods || []) {
    const k = MEAL_TYPES.includes(f.mealType) ? f.mealType : 'other';
    m[k].push(f);
  }
  return m;
}

function Sheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal
      aria-labelledby="nutrition-sheet-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 motion-reduce:animate-none motion-reduce:opacity-100 animate-ui-backdrop-in"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(88dvh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0f141d] shadow-2xl motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none animate-ui-nutrition-modal-in safe-pb">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800/90 px-4 py-3">
          <h2 id="nutrition-sheet-title" className="min-w-0 truncate text-lg font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] touch-manipulation rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function MacroBar({ label, current, target, emphasize }) {
  const pct = progressPct(current, target);
  return (
    <div className={emphasize ? 'rounded-lg ring-1 ring-blue-500/30' : ''}>
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span className="font-medium text-slate-300">{label}</span>
        <span>
          {roundMacro(current)}
          {target != null && target > 0 ? ` / ${roundMacro(target)} g` : ' g'}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
          style={{ width: pct == null ? '0%' : `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

export default function Nutrition() {
  const [dayKey, setDayKey] = useState(() => dayKeyInBucharest());
  const [log, setLog] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');

  const [dayForm, setDayForm] = useState({
    bodyWeight: '',
    calorieTarget: '',
    proteinTarget: '',
    carbsTarget: '',
    fatsTarget: '',
  });
  const [savingDay, setSavingDay] = useState(false);

  const [sheet, setSheet] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchDegraded, setSearchDegraded] = useState(false);
  const searchSeq = useRef(0);
  const searchAbortRef = useRef(null);

  const [suggestions, setSuggestions] = useState([]);
  const [recentFoods, setRecentFoods] = useState([]);

  const [pick, setPick] = useState(null);
  const [logGrams, setLogGrams] = useState('100');
  const [logMeal, setLogMeal] = useState('lunch');
  const [logManualMacros, setLogManualMacros] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
  });
  const [savingFood, setSavingFood] = useState(false);
  const logMacrosManualRef = useRef(false);

  const [manual, setManual] = useState({
    name: '',
    amount: '1',
    unit: 'serving',
    grams: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    mealType: 'lunch',
    notes: '',
  });

  const [editFood, setEditFood] = useState(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState('');
  const barcodeLookupSeqRef = useRef(0);

  const [libraryForm, setLibraryForm] = useState(() => ({ ...EMPTY_LIBRARY_FORM }));
  const [editingLibraryId, setEditingLibraryId] = useState(null);
  const [myLibraryList, setMyLibraryList] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [savingLibrary, setSavingLibrary] = useState(false);

  const loadLog = useCallback(async () => {
    setLoadErr('');
    try {
      const { data } = await api.get('/nutrition', { params: { dayKey } });
      const l = data.log;
      setLog(l);
      setDayForm({
        bodyWeight: l.bodyWeight != null ? String(l.bodyWeight) : '',
        calorieTarget: l.calorieTarget != null ? String(l.calorieTarget) : '',
        proteinTarget: l.proteinTarget != null ? String(l.proteinTarget) : '',
        carbsTarget: l.carbsTarget != null ? String(l.carbsTarget) : '',
        fatsTarget: l.fatsTarget != null ? String(l.fatsTarget) : '',
      });
    } catch (e) {
      setLoadErr(e.response?.data?.error || 'Could not load nutrition log.');
    } finally {
      setLoading(false);
    }
  }, [dayKey]);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/nutrition/history', { params: { days: 14 } });
      setHistory(data.days || []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadLog();
  }, [loadLog]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadMyLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const { data } = await api.get('/nutrition/my-foods', { params: { limit: 60 } });
      setMyLibraryList(Array.isArray(data.foods) ? data.foods : []);
    } catch {
      setMyLibraryList([]);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sheet !== 'myLibrary') return;
    loadMyLibrary();
  }, [sheet, loadMyLibrary]);

  useEffect(() => {
    if (sheet !== 'search') return;
    let cancelled = false;
    (async () => {
      try {
        const [sug, rec] = await Promise.all([
          api.get('/nutrition/suggestions', { params: { limit: 10 } }),
          api.get('/nutrition/recent-foods', { params: { limit: 12 } }),
        ]);
        if (!cancelled) {
          setSuggestions(sug.data.suggestions || []);
          setRecentFoods(rec.data.recent || []);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setRecentFoods([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sheet]);

  useEffect(() => {
    if (sheet !== 'search') return undefined;
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchErr('');
      setSearchLoading(false);
      setSearchDegraded(false);
      return undefined;
    }
    const t = window.setTimeout(async () => {
      searchAbortRef.current?.abort();
      const ac = new AbortController();
      searchAbortRef.current = ac;
      const seq = ++searchSeq.current;
      setSearchLoading(true);
      setSearchErr('');
      try {
        const { data } = await api.get('/nutrition/search', {
          params: { q },
          signal: ac.signal,
        });
        if (seq !== searchSeq.current) return;
        setSearchResults(Array.isArray(data.results) ? data.results : []);
        setSearchDegraded(!!data.degraded);
        if (data.error) setSearchErr(data.error);
      } catch (e) {
        if (e.code === 'ERR_CANCELED' || e.name === 'CanceledError') return;
        if (seq !== searchSeq.current) return;
        setSearchResults([]);
        setSearchErr('Search failed. You can still add a food manually.');
        setSearchDegraded(true);
      } finally {
        if (seq === searchSeq.current) setSearchLoading(false);
      }
    }, 340);
    return () => clearTimeout(t);
  }, [searchQ, sheet]);

  async function saveDaySettings(e) {
    e?.preventDefault?.();
    setSavingDay(true);
    try {
      const payload = {
        bodyWeight: dayForm.bodyWeight.trim() === '' ? null : Number(dayForm.bodyWeight),
        calorieTarget: dayForm.calorieTarget.trim() === '' ? null : Number(dayForm.calorieTarget),
        proteinTarget: dayForm.proteinTarget.trim() === '' ? null : Number(dayForm.proteinTarget),
        carbsTarget: dayForm.carbsTarget.trim() === '' ? null : Number(dayForm.carbsTarget),
        fatsTarget: dayForm.fatsTarget.trim() === '' ? null : Number(dayForm.fatsTarget),
      };
      for (const k of Object.keys(payload)) {
        const v = payload[k];
        if (v != null && !Number.isFinite(v)) {
          await appAlert('Check numeric values for weight and targets.');
          return;
        }
        if (v != null && v < 0) {
          await appAlert('Values cannot be negative.');
          return;
        }
      }
      const { data } = await api.put(`/nutrition/${dayKey}`, payload);
      setLog(data.log);
      await loadHistory();
    } catch (err0) {
      await appAlert(err0.response?.data?.error || 'Could not save.');
    } finally {
      setSavingDay(false);
    }
  }

  const openLogFromSearch = useCallback((row) => {
    logMacrosManualRef.current = false;
    setPick(row);
    const g =
      row?.servingGrams && safeNonNeg(row.servingGrams, 0) > 0
        ? String(roundMacro(row.servingGrams))
        : '100';
    setLogGrams(g);
    setLogMeal('lunch');
    const prev = previewFromPer100g(row, Number(g) || 0);
    setLogManualMacros({
      calories: String(prev.calories),
      protein: String(prev.protein),
      carbs: String(prev.carbs),
      fats: String(prev.fats),
    });
    setSheet('logPick');
  }, []);

  const handleBarcodeDecoded = useCallback(
    async (code) => {
      setScannerOpen(false);
      setSheet('barcodeLoading');
      const seq = ++barcodeLookupSeqRef.current;
      try {
        const { data } = await api.get(`/nutrition/barcode/${encodeURIComponent(code)}`);
        if (seq !== barcodeLookupSeqRef.current) return;
        if (data.found && data.product) {
          openLogFromSearch(data.product);
          return;
        }
        setNotFoundBarcode(String(data.barcode || code));
        setSheet('barcodeNotFound');
      } catch {
        if (seq !== barcodeLookupSeqRef.current) return;
        setNotFoundBarcode(String(code));
        setSheet('barcodeNotFound');
      }
    },
    [openLogFromSearch]
  );

  async function submitLibraryFood() {
    if (savingLibrary) return;
    const name = libraryForm.name.trim();
    if (!name) {
      await appAlert('Enter a food name.');
      return;
    }
    const parseOpt = (s) => {
      const t = String(s ?? '').trim();
      if (t === '') return null;
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 ? n : NaN;
    };
    const kcal = parseOpt(libraryForm.caloriesPer100g);
    const p = parseOpt(libraryForm.proteinPer100g);
    const c = parseOpt(libraryForm.carbsPer100g);
    const f = parseOpt(libraryForm.fatsPer100g);
    const fi = parseOpt(libraryForm.fiberPer100g);
    const su = parseOpt(libraryForm.sugarPer100g);
    const sgRaw = libraryForm.servingGrams.trim();
    const sg = sgRaw === '' ? null : Number(sgRaw);
    if ([kcal, p, c, f].some((x) => x != null && Number.isNaN(x))) {
      await appAlert('Check per-100g numbers (non-negative).');
      return;
    }
    if (sg != null && (!Number.isFinite(sg) || sg <= 0)) {
      await appAlert('Serving grams must be a positive number, or leave empty.');
      return;
    }
    if (fi != null && Number.isNaN(fi)) {
      await appAlert('Fiber must be a non-negative number or empty.');
      return;
    }
    if (su != null && Number.isNaN(su)) {
      await appAlert('Sugar must be a non-negative number or empty.');
      return;
    }

    const payload = {
      name,
      brand: libraryForm.brand.trim(),
      barcode: libraryForm.barcode.trim() || null,
      caloriesPer100g: kcal,
      proteinPer100g: p,
      carbsPer100g: c,
      fatsPer100g: f,
      fiberPer100g: fi,
      sugarPer100g: su,
      servingLabel: libraryForm.servingLabel.trim() || null,
      servingGrams: sg,
    };

    setSavingLibrary(true);
    try {
      if (editingLibraryId) {
        await api.put(`/nutrition/my-foods/${editingLibraryId}`, payload);
      } else {
        await api.post('/nutrition/my-foods', payload);
      }
      await loadMyLibrary();
      setEditingLibraryId(null);
      setLibraryForm({ ...EMPTY_LIBRARY_FORM });
      await appAlert('Saved to your foods. It appears in search and barcode lookup.');
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not save.');
    } finally {
      setSavingLibrary(false);
    }
  }

  async function deleteLibraryFood(row) {
    if (!row?.externalId?.startsWith('uf_')) return;
    const id = row.externalId.slice(3);
    if (!(await appConfirm('Remove this food from your saved list?'))) return;
    try {
      await api.delete(`/nutrition/my-foods/${id}`);
      await loadMyLibrary();
      if (editingLibraryId === id) {
        setEditingLibraryId(null);
        setLibraryForm({ ...EMPTY_LIBRARY_FORM });
      }
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not delete.');
    }
  }

  function openEditLibraryRow(row) {
    if (!row?.externalId?.startsWith('uf_')) return;
    const id = row.externalId.slice(3);
    setEditingLibraryId(id);
    setLibraryForm(pickRowToLibraryForm(row));
  }

  function openManualFromSuggestion(s) {
    setManual((m) => ({
      ...m,
      name: s.name,
      notes: s.hint || '',
    }));
    setSheet('manual');
  }

  useEffect(() => {
    if (sheet !== 'logPick' || !pick) return;
    if (logMacrosManualRef.current) return;
    const g = safeNonNeg(logGrams, 0);
    const prev = previewFromPer100g(pick, g);
    setLogManualMacros({
      calories: String(prev.calories),
      protein: String(prev.protein),
      carbs: String(prev.carbs),
      fats: String(prev.fats),
    });
  }, [logGrams, pick, sheet]);

  async function submitLogPick() {
    if (!pick || savingFood) return;
    const grams = safeNonNeg(logGrams, 0);
    if (grams <= 0) {
      await appAlert('Enter a valid amount (g or ml).');
      return;
    }
    const calories = roundCal(logManualMacros.calories);
    const protein = roundMacro(logManualMacros.protein);
    const carbs = roundMacro(logManualMacros.carbs);
    const fats = roundMacro(logManualMacros.fats);
    if (!Number.isFinite(calories) || calories < 0) {
      await appAlert('Enter calories.');
      return;
    }
    setSavingFood(true);
    try {
      const prev = previewFromPer100g(pick, grams);
      await api.post(`/nutrition/${dayKey}/foods`, {
        source: 'api',
        externalId: pick.externalId || undefined,
        name: pick.name,
        brand: pick.brand || '',
        servingLabel: pick.servingLabel || '',
        amount: grams,
        unit: 'g',
        grams,
        calories,
        protein,
        carbs,
        fats,
        fiber: prev.fiber,
        sugar: prev.sugar,
        mealType: logMeal,
        notes: '',
      });
      setSheet(null);
      setPick(null);
      await loadLog();
      await loadHistory();
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not save food.');
    } finally {
      setSavingFood(false);
    }
  }

  async function submitManual() {
    if (savingFood) return;
    const name = manual.name.trim();
    const amount = safeNonNeg(manual.amount, 0);
    if (!name || amount <= 0) {
      await appAlert('Enter a name and an amount greater than zero.');
      return;
    }
    const calories = roundCal(manual.calories);
    const protein = roundMacro(manual.protein);
    const carbs = roundMacro(manual.carbs);
    const fats = roundMacro(manual.fats);
    if (![calories, protein, carbs, fats].every((x) => Number.isFinite(x) && x >= 0)) {
      await appAlert('Enter valid calories and macros.');
      return;
    }
    setSavingFood(true);
    try {
      await api.post(`/nutrition/${dayKey}/foods`, {
        source: 'custom',
        name,
        brand: '',
        servingLabel: '',
        amount,
        unit: manual.unit.trim().slice(0, 32) || 'serving',
        grams: manual.grams.trim() === '' ? null : safeNonNeg(manual.grams, 0) || null,
        calories,
        protein,
        carbs,
        fats,
        mealType: manual.mealType,
        notes: manual.notes.trim().slice(0, 500),
      });
      setSheet(null);
      setManual({
        name: '',
        amount: '1',
        unit: 'serving',
        grams: '',
        calories: '',
        protein: '',
        carbs: '',
        fats: '',
        mealType: 'lunch',
        notes: '',
      });
      await loadLog();
      await loadHistory();
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not save.');
    } finally {
      setSavingFood(false);
    }
  }

  function openEdit(f) {
    setEditFood({
      ...f,
      amount: String(f.amount),
      grams: f.grams != null ? String(f.grams) : '',
      calories: String(f.calories),
      protein: String(f.protein),
      carbs: String(f.carbs),
      fats: String(f.fats),
      notes: f.notes || '',
    });
    setSheet('edit');
  }

  async function saveEdit() {
    if (!editFood || savingFood) return;
    setSavingFood(true);
    try {
      await api.patch(`/nutrition/${dayKey}/foods/${editFood.id}`, {
        name: editFood.name.trim(),
        amount: safeNonNeg(editFood.amount, 0),
        unit: editFood.unit.trim().slice(0, 32),
        grams: editFood.grams.trim() === '' ? null : safeNonNeg(editFood.grams, 0),
        calories: roundCal(editFood.calories),
        protein: roundMacro(editFood.protein),
        carbs: roundMacro(editFood.carbs),
        fats: roundMacro(editFood.fats),
        mealType: editFood.mealType || null,
        notes: editFood.notes.trim().slice(0, 500),
      });
      setSheet(null);
      setEditFood(null);
      await loadLog();
      await loadHistory();
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not update.');
    } finally {
      setSavingFood(false);
    }
  }

  async function removeFood(f) {
    if (!(await appConfirm('Delete this entry?'))) return;
    try {
      const { data } = await api.delete(`/nutrition/${dayKey}/foods/${f.id}`);
      setLog(data.log);
      await loadHistory();
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Delete failed.');
    }
  }

  async function duplicateYesterdayBreakfast() {
    const y = shiftDayKey(dayKey, -1);
    if (!y) return;
    try {
      const { data } = await api.get('/nutrition', { params: { dayKey: y } });
      const foods = (data.log?.foods || []).filter((f) => f.mealType === 'breakfast');
      if (foods.length === 0) {
        await appAlert('No breakfast logged yesterday.');
        return;
      }
      if (!(await appConfirm(`Copy ${foods.length} breakfast item(s) from yesterday?`))) return;
      setSavingFood(true);
      try {
        for (const f of foods) {
          await api.post(`/nutrition/${dayKey}/foods`, {
            source: f.source === 'api' ? 'api' : 'custom',
            externalId: f.externalId || undefined,
            name: f.name,
            brand: f.brand || '',
            servingLabel: f.servingLabel || '',
            amount: f.amount,
            unit: f.unit,
            grams: f.grams ?? null,
            calories: f.calories,
            protein: f.protein,
            carbs: f.carbs,
            fats: f.fats,
            fiber: f.fiber ?? null,
            sugar: f.sugar ?? null,
            mealType: 'breakfast',
            notes: f.notes
              ? `${String(f.notes).slice(0, 420)} (copied)`
              : 'Copied from yesterday',
          });
        }
        await loadLog();
        await loadHistory();
      } finally {
        setSavingFood(false);
      }
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Copy failed.');
    }
  }

  const totals = log?.totals || {
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
    sugar: 0,
  };
  const kcalTarget = log?.calorieTarget;
  const kcalPct = progressPct(totals.calories, kcalTarget);
  const kcalRemaining =
    kcalTarget != null && kcalTarget > 0 ? Math.round(kcalTarget - totals.calories) : null;

  const chartData = useMemo(() => {
    return (history || []).map((d) => ({
      label: d.dayKey?.slice(5) || '',
      dayKey: d.dayKey,
      calories: safeNonNeg(d.calories, 0),
      bodyWeight: d.bodyWeight != null ? safeNonNeg(d.bodyWeight, 0) : null,
    }));
  }, [history]);

  const hasWeightSeries = chartData.some((r) => r.bodyWeight != null && r.bodyWeight > 0);

  const grouped = groupFoods(log?.foods);

  const previewIncomplete = pick && previewFromPer100g(pick, safeNonNeg(logGrams, 0)).incomplete;

  if (loading && !log) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
        <span
          className="inline-block h-9 w-9 animate-spin rounded-full border-2 border-slate-600 border-t-accent motion-reduce:animate-none"
          aria-hidden
        />
        <span className="text-sm">Loading nutrition…</span>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Nutrition</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-slate-400">
          Log calories and macros by day. Search blends the Romanian reference with foods you save under
          <strong className="font-medium text-slate-200"> My foods </strong>
          (per 100 g, optional barcode). Scan barcodes via live camera or a single photo — no need to hold
          still while decoding a snapshot. Open Food Facts fills many packs; your library covers the rest.
        </p>
      </div>

      {loadErr ? (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {loadErr}
        </div>
      ) : null}

      <div className={`${CARD} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-between">
          <button
            type="button"
            className={`${BTN_GHOST} min-w-[48px] px-3`}
            aria-label="Previous day"
            onClick={() => {
              const p = shiftDayKey(dayKey, -1);
              if (p) setDayKey(p);
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-center sm:max-w-[14rem] sm:flex-none">
            <p className="text-xs uppercase tracking-wide text-slate-500">Day (Europe/Bucharest)</p>
            <p className="text-lg font-semibold text-white">{formatDayKeyDisplay(dayKey)}</p>
            <p className="text-xs text-slate-500">{dayKey}</p>
          </div>
          <button
            type="button"
            className={`${BTN_GHOST} min-w-[48px] px-3`}
            aria-label="Next day"
            onClick={() => {
              const n = shiftDayKey(dayKey, 1);
              if (n) setDayKey(n);
            }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={`${BTN_GHOST} px-4`}
            onClick={() => setDayKey(dayKeyInBucharest())}
          >
            Today
          </button>
        </div>
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            className={`${BTN_GHOST} w-full gap-2 sm:w-auto`}
            onClick={() => {
              setSearchQ('');
              setSearchResults([]);
              setSearchErr('');
              setSheet('search');
            }}
          >
            <Search className="h-4 w-4 shrink-0" />
            Search
          </button>
          <button
            type="button"
            className={`${BTN_GHOST} w-full gap-2 sm:w-auto`}
            onClick={() => setScannerOpen(true)}
          >
            <ScanBarcode className="h-4 w-4 shrink-0" />
            Scan barcode
          </button>
          <button
            type="button"
            className={`${BTN_GHOST} w-full gap-2 sm:w-auto`}
            onClick={() => {
              setEditingLibraryId(null);
              setLibraryForm({ ...EMPTY_LIBRARY_FORM });
              setSheet('myLibrary');
            }}
          >
            <Library className="h-4 w-4 shrink-0" />
            My foods
          </button>
          <button
            type="button"
            className={`${BTN_PRIMARY} w-full gap-2 sm:w-auto`}
            onClick={() => setSheet('manual')}
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add manually
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${CARD} border-blue-500/20`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Calories</p>
          <p className="mt-1 text-2xl font-bold text-white">{roundCal(totals.calories)} kcal</p>
          {kcalTarget != null && kcalTarget > 0 ? (
            <>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${kcalPct == null ? 0 : Math.min(100, kcalPct)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Target {roundCal(kcalTarget)} kcal
                {kcalRemaining != null ? (
                  <span className="text-slate-300">
                    {' '}
                    · {kcalRemaining >= 0 ? 'Remaining' : 'Over'}{' '}
                    <span className="font-semibold text-white">{Math.abs(kcalRemaining)}</span> kcal
                  </span>
                ) : null}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Set a calorie target below to see progress.</p>
          )}
        </div>
        <div className={`${CARD} ring-1 ring-blue-500/25`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Protein</p>
          <p className="mt-1 text-2xl font-bold text-blue-200">{roundMacro(totals.protein)} g</p>
          <p className="mt-1 text-xs text-slate-500">Key for recovery and muscle.</p>
        </div>
        <div className={CARD}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Carbs</p>
          <p className="mt-1 text-2xl font-bold text-white">{roundMacro(totals.carbs)} g</p>
        </div>
        <div className={CARD}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Fat</p>
          <p className="mt-1 text-2xl font-bold text-white">{roundMacro(totals.fats)} g</p>
        </div>
      </div>

      <div className={CARD}>
        <h3 className="text-sm font-semibold text-white">Progress vs targets (g)</h3>
        <div className="mt-4 space-y-3">
          <MacroBar
            label="Protein"
            current={totals.protein}
            target={log?.proteinTarget}
            emphasize
          />
          <MacroBar label="Carbs" current={totals.carbs} target={log?.carbsTarget} />
          <MacroBar label="Fat" current={totals.fats} target={log?.fatsTarget} />
        </div>
      </div>

      <form className={`${CARD} space-y-3`} onSubmit={saveDaySettings}>
        <h3 className="text-sm font-semibold text-white">Weight &amp; targets (selected day)</h3>
        <p className="text-xs text-slate-500">Metric: weight in kg, energy in kcal.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            Body weight (kg, optional)
            <input
              className={`${FIELD} mt-1`}
              inputMode="decimal"
              value={dayForm.bodyWeight}
              onChange={(e) => setDayForm((s) => ({ ...s, bodyWeight: e.target.value }))}
              placeholder="ex. 78.5"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Calorie target (kcal)
            <input
              className={`${FIELD} mt-1`}
              inputMode="numeric"
              value={dayForm.calorieTarget}
              onChange={(e) => setDayForm((s) => ({ ...s, calorieTarget: e.target.value }))}
              placeholder="ex. 2400"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Protein target (g)
            <input
              className={`${FIELD} mt-1`}
              inputMode="decimal"
              value={dayForm.proteinTarget}
              onChange={(e) => setDayForm((s) => ({ ...s, proteinTarget: e.target.value }))}
              placeholder="ex. 160"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Carb target (g)
            <input
              className={`${FIELD} mt-1`}
              inputMode="decimal"
              value={dayForm.carbsTarget}
              onChange={(e) => setDayForm((s) => ({ ...s, carbsTarget: e.target.value }))}
            />
          </label>
          <label className="block text-xs text-slate-400 sm:col-span-2">
            Fat target (g)
            <input
              className={`${FIELD} mt-1`}
              inputMode="decimal"
              value={dayForm.fatsTarget}
              onChange={(e) => setDayForm((s) => ({ ...s, fatsTarget: e.target.value }))}
            />
          </label>
        </div>
        <button type="submit" className={BTN_PRIMARY} disabled={savingDay}>
          {savingDay ? 'Saving…' : 'Save weight and targets'}
        </button>
      </form>

      <div className={CARD}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Foods</h3>
          <button
            type="button"
            className={`${BTN_GHOST} min-h-[44px] gap-2 touch-manipulation text-xs`}
            disabled={savingFood}
            onClick={() => duplicateYesterdayBreakfast()}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy yesterday&apos;s breakfast
          </button>
        </div>
        {!log?.foods?.length ? (
          <p className="text-sm text-slate-500">
            No foods yet. Search the database or add manually — manual entry always works, even if search is
            down.
          </p>
        ) : (
          <div className="space-y-6">
            {MEAL_ORDER.map((key) => {
              const items = grouped[key];
              if (!items.length) return null;
              return (
                <div key={key}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {MEAL_LABEL[key]}
                  </p>
                  <ul className="space-y-2">
                    {items.map((f) => (
                      <li
                        key={f.id}
                        className="flex flex-col gap-2 rounded-lg border border-slate-800/80 bg-surface/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white">{f.name}</p>
                          {f.brand ? <p className="text-xs text-slate-500">{f.brand}</p> : null}
                          <p className="mt-1 text-sm text-slate-400">
                            {roundMacro(f.amount)} {f.unit}
                            {f.grams != null ? ` · ${roundMacro(f.grams)} g` : ''} ·{' '}
                            {roundCal(f.calories)} kcal · P {roundMacro(f.protein)} · C{' '}
                            {roundMacro(f.carbs)} · F {roundMacro(f.fats)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
                            aria-label="Edit"
                            onClick={() => openEdit(f)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-700 p-2 text-red-300 hover:bg-red-950/40"
                            aria-label="Delete"
                            onClick={() => removeFood(f)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={CARD}>
        <h3 className="text-sm font-semibold text-white">Last 14 days</h3>
        <p className="mt-1 text-xs text-slate-500">Calories and weight when logged.</p>
        {chartData.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Not enough data for the chart yet.</p>
        ) : (
          <div className="mt-4 h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis
                  yAxisId="kcal"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  width={36}
                  label={{ value: 'kcal', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                />
                {hasWeightSeries ? (
                  <YAxis
                    yAxisId="kg"
                    orientation="right"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    width={36}
                    domain={['auto', 'auto']}
                    label={{ value: 'kg', angle: 90, position: 'insideRight', fill: '#64748b' }}
                  />
                ) : null}
                <Tooltip
                  contentStyle={{
                    background: '#0f141d',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Area
                  yAxisId="kcal"
                  type="monotone"
                  dataKey="calories"
                  fill="rgba(59,130,246,0.15)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
                {hasWeightSeries ? (
                  <Line
                    yAxisId="kg"
                    type="monotone"
                    dataKey="bodyWeight"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <Sheet
        open={sheet === 'search'}
        title="Search foods"
        onClose={() => {
          setSheet(null);
          setSearchQ('');
        }}
      >
        <label className="block text-xs text-slate-400">
          Search (any language)
          <input
            className={`${FIELD} mt-1`}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="e.g. yogurt, chicken breast, rice"
            autoComplete="off"
          />
        </label>
        {searchErr ? <p className="mt-2 text-sm text-amber-200">{searchErr}</p> : null}
        {searchDegraded && !searchErr ? (
          <p className="mt-2 text-xs text-slate-500">Results may be incomplete — try manual add.</p>
        ) : null}

        {searchQ.trim().length < 2 ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Quick ideas</p>
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li key={s.name}>
                    <button
                      type="button"
                      className="min-h-[52px] w-full touch-manipulation rounded-lg border border-slate-800 bg-surface/50 px-3 py-3 text-left text-sm text-white hover:bg-slate-800/60"
                      onClick={() => openManualFromSuggestion(s)}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{s.hint}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {recentFoods.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Recent</p>
                <ul className="flex flex-wrap gap-2">
                  {recentFoods.map((r, i) => (
                    <li key={`${r.name}-${i}`}>
                      <button
                        type="button"
                        className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                        onClick={() => {
                          setManual((m) => ({
                            ...m,
                            name: r.name,
                            unit: r.lastUnit || m.unit,
                            amount:
                              r.lastAmount != null && r.lastAmount > 0
                                ? String(r.lastAmount)
                                : m.amount,
                            grams: r.lastGrams != null ? String(r.lastGrams) : m.grams,
                          }));
                          setSheet('manual');
                        }}
                      >
                        {r.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {searchLoading ? (
          <p className="mt-4 text-sm text-slate-400">Searching…</p>
        ) : searchQ.trim().length >= 2 && !searchResults.length && !searchErr ? (
          <p className="mt-4 text-sm text-slate-500">No results. Add manually or try another term.</p>
        ) : null}

        <ul className="mt-4 space-y-2">
          {searchResults.map((r, ri) => (
            <li key={`${r.externalId || 'noid'}-${ri}-${r.name?.slice(0, 24) || ''}`}>
              <button
                type="button"
                className="min-h-[52px] w-full touch-manipulation rounded-lg border border-slate-800 bg-surface/50 px-3 py-3 text-left hover:bg-slate-800/60"
                onClick={() => openLogFromSearch(r)}
              >
                <p className="flex flex-wrap items-center gap-2 font-medium text-white">
                  <span>{r.name}</span>
                  {r.source === 'user_library' ? (
                    <span className="rounded bg-violet-900/45 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                      My food
                    </span>
                  ) : null}
                </p>
                {r.brand ? <p className="text-xs text-slate-500">{r.brand}</p> : null}
                <p className="mt-1 text-xs text-slate-400">
                  {r.caloriesPer100g != null ? `${roundCal(r.caloriesPer100g)} kcal / 100g` : 'no kcal/100g'}
                  {r.servingLabel ? ` · ${r.servingLabel}` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`${BTN_GHOST} mt-4 w-full text-sm`}
          onClick={() => {
            setEditingLibraryId(null);
            setLibraryForm({ ...EMPTY_LIBRARY_FORM });
            setSheet('myLibrary');
          }}
        >
          <Library className="mr-2 inline h-4 w-4 align-text-bottom" />
          Manage my foods (save per 100 g)
        </button>
      </Sheet>

      <Sheet
        open={sheet === 'barcodeLoading'}
        title="Looking up product"
        onClose={() => {
          barcodeLookupSeqRef.current += 1;
          setSheet(null);
        }}
      >
        <p className="text-sm text-slate-400">Checking Open Food Facts and your saved foods…</p>
      </Sheet>

      <Sheet
        open={sheet === 'barcodeNotFound'}
        title="Product not found"
        onClose={() => {
          setSheet(null);
          setNotFoundBarcode('');
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            No match online or in your saved foods. Coverage is incomplete for some local packs — add details to
            <strong className="font-medium text-white"> My foods </strong>
            (per 100 g) so the next scan finds it, or use manual entry / text search.
          </p>
          {notFoundBarcode ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">
              <p className="text-xs text-slate-500">Barcode</p>
              <p className="font-mono text-sm text-white">{notFoundBarcode}</p>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={`${BTN_GHOST} w-full`}
              onClick={async () => {
                if (notFoundBarcode && navigator.clipboard?.writeText) {
                  try {
                    await navigator.clipboard.writeText(notFoundBarcode);
                  } catch {
                    /* ignore */
                  }
                }
              }}
            >
              Copy barcode
            </button>
            {notFoundBarcode ? (
              <button
                type="button"
                className={`${BTN_PRIMARY} w-full`}
                onClick={() => {
                  const b = notFoundBarcode;
                  setNotFoundBarcode('');
                  setLibraryForm({ ...EMPTY_LIBRARY_FORM, barcode: b });
                  setEditingLibraryId(null);
                  setSheet('myLibrary');
                }}
              >
                Save barcode to my foods
              </button>
            ) : null}
            <button
              type="button"
              className={`${notFoundBarcode ? BTN_GHOST : BTN_PRIMARY} w-full`}
              onClick={() => {
                const b = notFoundBarcode;
                setSheet(null);
                setNotFoundBarcode('');
                setManual((m) => ({
                  ...m,
                  notes: b ? `Barcode ${b}` : m.notes,
                }));
                setSheet('manual');
              }}
            >
              Add manually
            </button>
            <button
              type="button"
              className={`${BTN_GHOST} w-full`}
              onClick={() => {
                setSheet(null);
                setNotFoundBarcode('');
                setSearchQ('');
                setSearchResults([]);
                setSearchErr('');
                setSheet('search');
              }}
            >
              Try text search
            </button>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'myLibrary'}
        title="My foods"
        onClose={() => {
          setSheet(null);
          setEditingLibraryId(null);
        }}
      >
        <p className="text-xs leading-relaxed text-slate-400">
          Store foods with nutrition per 100 g. They show in search when the name or brand matches, and your
          barcode is checked if Open Food Facts has no product.
        </p>
        {libraryLoading ? (
          <p className="mt-3 text-sm text-slate-400">Loading your list…</p>
        ) : myLibraryList.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No saved foods yet. Fill the form below.</p>
        ) : (
          <ul className="mt-3 max-h-[min(36vh,320px)] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {myLibraryList.map((row) => (
              <li
                key={row.externalId}
                className="flex items-stretch gap-2 rounded-lg border border-slate-800 bg-surface/40 p-2"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 touch-manipulation text-left"
                  onClick={() => openEditLibraryRow(row)}
                >
                  <p className="font-medium text-white">{row.name}</p>
                  {row.brand ? <p className="text-xs text-slate-500">{row.brand}</p> : null}
                  {row.barcode ? (
                    <p className="font-mono text-xs text-slate-500">Barcode {row.barcode}</p>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="min-h-[44px] min-w-[44px] shrink-0 touch-manipulation rounded-lg border border-slate-700 p-2 text-red-300 hover:bg-red-950/30"
                  aria-label="Delete"
                  onClick={() => deleteLibraryFood(row)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {editingLibraryId ? 'Edit entry' : 'Add entry'}
          </p>
          <label className="block text-xs text-slate-400">
            Name
            <input
              className={`${FIELD} mt-1`}
              value={libraryForm.name}
              onChange={(e) => setLibraryForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="Product name"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Brand (optional)
            <input
              className={`${FIELD} mt-1`}
              value={libraryForm.brand}
              onChange={(e) => setLibraryForm((s) => ({ ...s, brand: e.target.value }))}
              autoComplete="off"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Barcode (optional, digits)
            <input
              className={`${FIELD} mt-1 font-mono`}
              inputMode="numeric"
              value={libraryForm.barcode}
              onChange={(e) => setLibraryForm((s) => ({ ...s, barcode: e.target.value }))}
              placeholder="EAN-13 / UPC"
              autoComplete="off"
            />
          </label>
          <p className="text-xs text-slate-500">Per 100 g (or 100 ml). Leave blank if unknown.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              kcal / 100g
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={libraryForm.caloriesPer100g}
                onChange={(e) => setLibraryForm((s) => ({ ...s, caloriesPer100g: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Protein g
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={libraryForm.proteinPer100g}
                onChange={(e) => setLibraryForm((s) => ({ ...s, proteinPer100g: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Carbs g
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={libraryForm.carbsPer100g}
                onChange={(e) => setLibraryForm((s) => ({ ...s, carbsPer100g: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Fat g
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={libraryForm.fatsPer100g}
                onChange={(e) => setLibraryForm((s) => ({ ...s, fatsPer100g: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Fiber g (opt.)
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={libraryForm.fiberPer100g}
                onChange={(e) => setLibraryForm((s) => ({ ...s, fiberPer100g: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Sugar g (opt.)
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={libraryForm.sugarPer100g}
                onChange={(e) => setLibraryForm((s) => ({ ...s, sugarPer100g: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-xs text-slate-400">
            Serving label (optional)
            <input
              className={`${FIELD} mt-1`}
              value={libraryForm.servingLabel}
              onChange={(e) => setLibraryForm((s) => ({ ...s, servingLabel: e.target.value }))}
              placeholder='e.g. 1 cup (30 g)'
              autoComplete="off"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Serving grams (optional)
            <input
              className={`${FIELD} mt-1`}
              inputMode="decimal"
              value={libraryForm.servingGrams}
              onChange={(e) => setLibraryForm((s) => ({ ...s, servingGrams: e.target.value }))}
              placeholder="Default portion in g"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className={`${BTN_PRIMARY} min-h-[48px] flex-1`}
              disabled={savingLibrary}
              onClick={submitLibraryFood}
            >
              {savingLibrary ? 'Saving…' : editingLibraryId ? 'Update' : 'Save to my foods'}
            </button>
            {editingLibraryId ? (
              <button
                type="button"
                className={`${BTN_GHOST} min-h-[48px] flex-1`}
                disabled={savingLibrary}
                onClick={() => {
                  setEditingLibraryId(null);
                  setLibraryForm({ ...EMPTY_LIBRARY_FORM });
                }}
              >
                New item
              </button>
            ) : null}
          </div>
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'logPick'}
        title="Log food"
        onClose={() => {
          setSheet(null);
          setPick(null);
        }}
      >
        {pick ? (
          <div className="space-y-3">
            {pick.imageUrl ? (
              <img
                src={pick.imageUrl}
                alt=""
                className="mx-auto max-h-28 max-w-full rounded-lg border border-slate-800 object-contain"
              />
            ) : null}
            <p className="text-sm text-white">{pick.name}</p>
            {pick.source === 'openfoodfacts' ? (
              <p className="text-xs text-slate-500">Source: Open Food Facts (values per 100 g unless adjusted).</p>
            ) : null}
            {pick.source === 'user_library' ? (
              <p className="text-xs text-slate-500">From your saved foods (per 100 g).</p>
            ) : null}
            <button
              type="button"
              className={`${BTN_GHOST} w-full text-sm`}
              onClick={() => {
                const libId =
                  pick?.source === 'user_library' && pick?.externalId?.startsWith('uf_')
                    ? pick.externalId.slice(3)
                    : null;
                setLibraryForm(pickRowToLibraryForm(pick));
                setEditingLibraryId(libId);
                setSheet('myLibrary');
              }}
            >
              {pick?.source === 'user_library' && pick?.externalId?.startsWith('uf_')
                ? 'Edit in my foods'
                : 'Save copy to my foods'}
            </button>
            {previewIncomplete ? (
              <p className="text-xs text-amber-200">
                Nutrition data is incomplete in the database — adjust the values below if needed.
              </p>
            ) : null}
            <label className="block text-xs text-slate-400">
              Amount (g or ml — both scale the same way)
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={logGrams}
                onChange={(e) => {
                  setLogGrams(e.target.value);
                  logMacrosManualRef.current = false;
                }}
              />
            </label>
            <button
              type="button"
              className="text-xs font-medium text-blue-400 underline decoration-blue-500/40 underline-offset-2"
              onClick={() => {
                logMacrosManualRef.current = false;
                const g = safeNonNeg(logGrams, 0);
                const prev = previewFromPer100g(pick, g);
                setLogManualMacros({
                  calories: String(prev.calories),
                  protein: String(prev.protein),
                  carbs: String(prev.carbs),
                  fats: String(prev.fats),
                });
              }}
            >
              Recalculate macros from amount
            </button>
            <label className="block text-xs text-slate-400">
              Meal
              <select
                className={`${FIELD} mt-1`}
                value={logMeal}
                onChange={(e) => setLogMeal(e.target.value)}
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">
                kcal
                <input
                  className={`${FIELD} mt-1`}
                  inputMode="numeric"
                  value={logManualMacros.calories}
                  onChange={(e) => {
                    logMacrosManualRef.current = true;
                    setLogManualMacros((s) => ({ ...s, calories: e.target.value }));
                  }}
                />
              </label>
              <label className="text-xs text-slate-400">
                P / C / F (g)
                <input
                  className={`${FIELD} mt-1`}
                  inputMode="decimal"
                  value={logManualMacros.protein}
                  onChange={(e) => {
                    logMacrosManualRef.current = true;
                    setLogManualMacros((s) => ({ ...s, protein: e.target.value }));
                  }}
                  placeholder="P"
                />
              </label>
              <label className="text-xs text-slate-400">
                <span className="opacity-0">C</span>
                <input
                  className={`${FIELD} mt-1`}
                  inputMode="decimal"
                  value={logManualMacros.carbs}
                  onChange={(e) => {
                    logMacrosManualRef.current = true;
                    setLogManualMacros((s) => ({ ...s, carbs: e.target.value }));
                  }}
                  placeholder="C"
                />
              </label>
              <label className="text-xs text-slate-400">
                <span className="opacity-0">F</span>
                <input
                  className={`${FIELD} mt-1`}
                  inputMode="decimal"
                  value={logManualMacros.fats}
                  onChange={(e) => {
                    logMacrosManualRef.current = true;
                    setLogManualMacros((s) => ({ ...s, fats: e.target.value }));
                  }}
                  placeholder="F"
                />
              </label>
            </div>
            <button type="button" className={`${BTN_PRIMARY} w-full`} disabled={savingFood} onClick={submitLogPick}>
              {savingFood ? 'Saving…' : 'Save to log'}
            </button>
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={sheet === 'manual'}
        title="Add manually"
        onClose={() => setSheet(null)}
      >
        <div className="space-y-3">
          <label className="block text-xs text-slate-400">
            Name
            <input
              className={`${FIELD} mt-1`}
              value={manual.name}
              onChange={(e) => setManual((s) => ({ ...s, name: e.target.value }))}
              placeholder="e.g. homemade stew"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Amount
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={manual.amount}
                onChange={(e) => setManual((s) => ({ ...s, amount: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Unit
              <input
                className={`${FIELD} mt-1`}
                value={manual.unit}
                onChange={(e) => setManual((s) => ({ ...s, unit: e.target.value }))}
                placeholder="g, ml, serving"
              />
            </label>
          </div>
          <label className="block text-xs text-slate-400">
            Estimated grams (optional)
            <input
              className={`${FIELD} mt-1`}
              inputMode="decimal"
              value={manual.grams}
              onChange={(e) => setManual((s) => ({ ...s, grams: e.target.value }))}
              placeholder="ex. 200"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              kcal
              <input
                className={`${FIELD} mt-1`}
                inputMode="numeric"
                value={manual.calories}
                onChange={(e) => setManual((s) => ({ ...s, calories: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Protein (g)
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={manual.protein}
                onChange={(e) => setManual((s) => ({ ...s, protein: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Carbs (g)
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={manual.carbs}
                onChange={(e) => setManual((s) => ({ ...s, carbs: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Fat (g)
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={manual.fats}
                onChange={(e) => setManual((s) => ({ ...s, fats: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-xs text-slate-400">
            Meal
            <select
              className={`${FIELD} mt-1`}
              value={manual.mealType}
              onChange={(e) => setManual((s) => ({ ...s, mealType: e.target.value }))}
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Notes (optional)
            <input
              className={`${FIELD} mt-1`}
              value={manual.notes}
              onChange={(e) => setManual((s) => ({ ...s, notes: e.target.value }))}
            />
          </label>
          <button type="button" className={`${BTN_PRIMARY} w-full`} disabled={savingFood} onClick={submitManual}>
            {savingFood ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'edit'}
        title="Edit food"
        onClose={() => {
          setSheet(null);
          setEditFood(null);
        }}
      >
        {editFood ? (
          <div className="space-y-3">
            <label className="block text-xs text-slate-400">
              Name
              <input
                className={`${FIELD} mt-1`}
                value={editFood.name}
                onChange={(e) => setEditFood((s) => ({ ...s, name: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">
                Amount
                <input
                  className={`${FIELD} mt-1`}
                  inputMode="decimal"
                  value={editFood.amount}
                  onChange={(e) => setEditFood((s) => ({ ...s, amount: e.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-400">
                Unit
                <input
                  className={`${FIELD} mt-1`}
                  value={editFood.unit}
                  onChange={(e) => setEditFood((s) => ({ ...s, unit: e.target.value }))}
                />
              </label>
            </div>
            <label className="block text-xs text-slate-400">
              Grams (optional)
              <input
                className={`${FIELD} mt-1`}
                inputMode="decimal"
                value={editFood.grams}
                onChange={(e) => setEditFood((s) => ({ ...s, grams: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">
                kcal
                <input
                  className={`${FIELD} mt-1`}
                  value={editFood.calories}
                  onChange={(e) => setEditFood((s) => ({ ...s, calories: e.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-400">
                P (g)
                <input
                  className={`${FIELD} mt-1`}
                  value={editFood.protein}
                  onChange={(e) => setEditFood((s) => ({ ...s, protein: e.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-400">
                C (g)
                <input
                  className={`${FIELD} mt-1`}
                  value={editFood.carbs}
                  onChange={(e) => setEditFood((s) => ({ ...s, carbs: e.target.value }))}
                />
              </label>
              <label className="text-xs text-slate-400">
                F (g)
                <input
                  className={`${FIELD} mt-1`}
                  value={editFood.fats}
                  onChange={(e) => setEditFood((s) => ({ ...s, fats: e.target.value }))}
                />
              </label>
            </div>
            <label className="block text-xs text-slate-400">
              Meal
              <select
                className={`${FIELD} mt-1`}
                value={editFood.mealType || ''}
                onChange={(e) => setEditFood((s) => ({ ...s, mealType: e.target.value || null }))}
              >
                <option value="">Uncategorized</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Notes
              <input
                className={`${FIELD} mt-1`}
                value={editFood.notes}
                onChange={(e) => setEditFood((s) => ({ ...s, notes: e.target.value }))}
              />
            </label>
            <button type="button" className={`${BTN_PRIMARY} w-full`} disabled={savingFood} onClick={saveEdit}>
              {savingFood ? 'Saving…' : 'Update'}
            </button>
          </div>
        ) : null}
      </Sheet>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBarcodeScanned={handleBarcodeDecoded}
      />
    </div>
  );
}
