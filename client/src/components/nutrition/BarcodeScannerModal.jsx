import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ImageUp, X } from 'lucide-react';

const READER_ID = 'ironlog-barcode-reader';
const HIDDEN_READER_ID = 'ironlog-barcode-hidden-slot';

const BTN_PRIMARY =
  'inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const BTN_GHOST =
  'inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-lg border border-slate-700 bg-slate-800/40 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800/70 active:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';
const TAB_ACTIVE = 'border-blue-500 text-white';
const TAB_IDLE = 'border-transparent text-slate-400 hover:text-slate-200';

async function getHtml5Formats() {
  const mod = await import('html5-qrcode');
  return {
    Html5Qrcode: mod.Html5Qrcode,
    Html5QrcodeSupportedFormats: mod.Html5QrcodeSupportedFormats,
  };
}

function barcodeFormatsConfig(Html5QrcodeSupportedFormats) {
  return {
    verbose: false,
    /** Native BarcodeDetector in Chromium is much faster than pure-JS decode when available. */
    useBarCodeDetectorIfSupported: true,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
    ],
  };
}

function normalizeBarcodeDigits(text) {
  const digits = String(text || '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

/**
 * Decode EAN/UPC from a still image (photo or video frame).
 */
export async function decodeBarcodeFromImageFile(file) {
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await getHtml5Formats();
  let el = document.getElementById(HIDDEN_READER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = HIDDEN_READER_ID;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;overflow:hidden;opacity:0';
    document.body.appendChild(el);
  }
  const html5 = new Html5Qrcode(HIDDEN_READER_ID, barcodeFormatsConfig(Html5QrcodeSupportedFormats));
  try {
    const decoded = await html5.scanFile(file, false);
    return normalizeBarcodeDigits(decoded);
  } finally {
    try {
      html5.clear();
    } catch {
      /* ignore */
    }
  }
}

async function videoToJpegFile(video) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Could not capture image'));
        else resolve(new File([blob], 'barcode-snap.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92
    );
  });
}

/**
 * Centered modal: live scan, or photo / snapshot decode (no need to hold steady for continuous scan).
 */
export default function BarcodeScannerModal({ open, onClose, onBarcodeScanned }) {
  const scannerRef = useRef(null);
  const lockedRef = useRef(false);
  const lastHitRef = useRef({ digits: '', t: 0 });
  const onBarcodeRef = useRef(onBarcodeScanned);
  const fileInputRef = useRef(null);

  const [scanMode, setScanMode] = useState('live');
  const [uiError, setUiError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processNote, setProcessNote] = useState('');

  useEffect(() => {
    onBarcodeRef.current = onBarcodeScanned;
  }, [onBarcodeScanned]);

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
      if (e.key === 'Escape' && !processing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, processing]);

  useEffect(() => {
    if (!open) {
      setScanMode('live');
      setProcessing(false);
      setProcessNote('');
      lockedRef.current = false;
      lastHitRef.current = { digits: '', t: 0 };
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (inst) {
        inst
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              inst.clear();
            } catch {
              /* ignore */
            }
          });
      }
      setUiError('');
      return;
    }
  }, [open]);

  const finishBarcode = useCallback((digits) => {
    if (!digits) return;
    lockedRef.current = true;
    onBarcodeRef.current(digits);
  }, []);

  const runDecodeFromFile = useCallback(
    async (file) => {
      if (!file || lockedRef.current) return;
      setProcessing(true);
      setProcessNote('Reading barcode from photo…');
      setUiError('');
      try {
        const digits = await decodeBarcodeFromImageFile(file);
        if (digits) {
          finishBarcode(digits);
          return;
        }
        setUiError('No barcode found in this image. Try a closer, well-lit photo of the bars.');
      } catch (e) {
        setUiError(
          e?.message
            ? String(e.message)
            : 'Could not read this image. Try another photo or use live scan.'
        );
      } finally {
        setProcessing(false);
        setProcessNote('');
      }
    },
    [finishBarcode]
  );

  const snapCurrentFrame = useCallback(async () => {
    if (lockedRef.current) return;
    const html5 = scannerRef.current;
    const wrap = document.getElementById(READER_ID);
    const video = wrap?.querySelector('video');
    if (!html5?.isScanning || !video) {
      setUiError('Start the camera first, then capture.');
      return;
    }
    setProcessing(true);
    setProcessNote('Processing snapshot…');
    setUiError('');
    let resumed = false;
    try {
      html5.pause(true);
      const file = await videoToJpegFile(video);
      if (!file) throw new Error('Could not capture frame');
      const digits = await decodeBarcodeFromImageFile(file);
      if (digits) {
        lockedRef.current = true;
        try {
          await html5.stop();
        } catch {
          /* ignore */
        }
        try {
          html5.clear();
        } catch {
          /* ignore */
        }
        if (scannerRef.current === html5) scannerRef.current = null;
        onBarcodeRef.current(digits);
        return;
      }
      setUiError('No barcode in this snapshot. Adjust framing and try again, or use Take photo.');
      html5.resume();
      resumed = true;
    } catch (e) {
      setUiError(e?.message ? String(e.message) : 'Snapshot failed. Try again.');
      try {
        html5.resume();
        resumed = true;
      } catch {
        /* ignore */
      }
    } finally {
      if (!resumed && html5?.isScanning) {
        try {
          html5.resume();
        } catch {
          /* ignore */
        }
      }
      setProcessing(false);
      setProcessNote('');
    }
  }, []);

  useEffect(() => {
    if (!open || scanMode !== 'live') {
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (inst) {
        inst
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              inst.clear();
            } catch {
              /* ignore */
            }
          });
      }
      if (!open) return;
      return;
    }

    let alive = true;
    lockedRef.current = false;
    lastHitRef.current = { digits: '', t: 0 };
    setUiError('');

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setUiError(
        'Camera access needs a secure page: use HTTPS or open IronLogger on localhost. On plain HTTP the browser blocks the camera.'
      );
      return () => {
        alive = false;
      };
    }

    if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
      setUiError(
        'This browser does not support camera capture here. Use Photo mode or add food manually.'
      );
      return () => {
        alive = false;
      };
    }

    const run = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await getHtml5Formats();
        if (!alive) return;

        const html5 = new Html5Qrcode(READER_ID, barcodeFormatsConfig(Html5QrcodeSupportedFormats));
        if (!alive) {
          try {
            html5.clear();
          } catch {
            /* ignore */
          }
          return;
        }
        scannerRef.current = html5;

        const onDecoded = async (decodedText) => {
          if (!alive || lockedRef.current) return;
          const digits = normalizeBarcodeDigits(decodedText);
          if (!digits) return;
          const now = Date.now();
          const last = lastHitRef.current;
          if (last.digits === digits && now - last.t < 90) return;
          lastHitRef.current = { digits, t: now };

          lockedRef.current = true;
          try {
            await html5.stop();
          } catch {
            /* ignore */
          }
          try {
            html5.clear();
          } catch {
            /* ignore */
          }
          if (scannerRef.current === html5) scannerRef.current = null;
          if (alive) onBarcodeRef.current(digits);
        };

        const scanConfig = {
          fps: 30,
          qrbox: (viewfinderW, viewfinderH) => {
            const w = Math.min(340, Math.floor(viewfinderW * 0.92));
            const h = Math.min(200, Math.floor(viewfinderH * 0.42));
            return { width: w, height: Math.max(88, h) };
          },
        };

        try {
          await html5.start({ facingMode: 'environment' }, scanConfig, onDecoded, () => {});
        } catch (e1) {
          if (!alive) return;
          try {
            await html5.stop();
          } catch {
            /* ignore */
          }
          try {
            html5.clear();
          } catch {
            /* ignore */
          }
          const cams = await Html5Qrcode.getCameras();
          if (!alive) return;
          if (!cams?.length) {
            throw e1;
          }
          await html5.start(cams[0].id, scanConfig, onDecoded, () => {});
        }
      } catch (e) {
        if (!alive) return;
        const name = e?.name || '';
        const msg = String(e?.message || '');
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setUiError('Camera permission denied. Allow camera access, then tap Try again or use Photo mode.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setUiError('No suitable camera was found. Use Photo mode or add food manually.');
        } else {
          setUiError(msg || 'Could not start the camera.');
        }
      }
    };

    void run();

    return () => {
      alive = false;
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (inst) {
        inst
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              inst.clear();
            } catch {
              /* ignore */
            }
          });
      }
    };
  }, [open, scanMode, retryKey]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal
      aria-labelledby="barcode-scanner-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 motion-reduce:animate-none motion-reduce:opacity-100 animate-ui-backdrop-in"
        aria-label="Close"
        onClick={processing ? undefined : onClose}
        disabled={processing}
      />
      <div className="relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0a0e14] shadow-2xl motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none animate-ui-nutrition-modal-in safe-pb">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800/90 px-4 py-3 safe-pt">
          <div className="min-w-0">
            <h2 id="barcode-scanner-title" className="text-lg font-semibold text-white">
              Scan food barcode
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Packaged products (EAN / UPC). HTTPS or localhost required for the camera.
            </p>
          </div>
          <button
            type="button"
            className="min-h-[48px] min-w-[48px] touch-manipulation rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40"
            aria-label="Close"
            onClick={onClose}
            disabled={processing}
          >
            <X className="h-6 w-6" strokeWidth={2} />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-slate-800/80 px-2 pt-2">
          <button
            type="button"
            className={`min-h-[48px] flex-1 touch-manipulation rounded-t-lg border-b-2 px-2 text-sm font-medium transition-colors ${scanMode === 'live' ? TAB_ACTIVE : TAB_IDLE}`}
            onClick={() => {
              if (processing) return;
              setScanMode('live');
              setUiError('');
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <Camera className="h-4 w-4 shrink-0" />
              Live
            </span>
          </button>
          <button
            type="button"
            className={`min-h-[48px] flex-1 touch-manipulation rounded-t-lg border-b-2 px-2 text-sm font-medium transition-colors ${scanMode === 'photo' ? TAB_ACTIVE : TAB_IDLE}`}
            onClick={() => {
              if (processing) return;
              setScanMode('photo');
              setUiError('');
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <ImageUp className="h-4 w-4 shrink-0" />
              Photo
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {processing ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-300">
              <span
                className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500 motion-reduce:animate-none"
                aria-hidden
              />
              <p className="text-sm">{processNote || 'Working…'}</p>
            </div>
          ) : scanMode === 'photo' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Take or choose a photo of the barcode. The app decodes a single still image — you do not need
                to hold the phone steady like in live mode.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) runDecodeFromFile(f);
                }}
              />
              <button type="button" className={`${BTN_PRIMARY} w-full`} onClick={() => fileInputRef.current?.click()}>
                Take or choose photo
              </button>
              <p className="text-center text-xs text-slate-500">Gallery uploads work on desktop; on phones this opens the camera.</p>
            </div>
          ) : uiError ? (
            <div className="space-y-4">
              <p className="text-sm text-amber-200">{uiError}</p>
              <button
                type="button"
                className={`${BTN_PRIMARY} w-full`}
                onClick={() => {
                  setUiError('');
                  setRetryKey((k) => k + 1);
                }}
              >
                Try again
              </button>
              <button type="button" className={`${BTN_GHOST} w-full`} onClick={() => setScanMode('photo')}>
                Use photo instead
              </button>
              <button type="button" className={`${BTN_GHOST} w-full`} onClick={onClose}>
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="mb-3 text-center text-xs text-slate-400">
                Live mode reads continuously. Or tap <strong className="text-slate-300">Decode snapshot</strong> to
                freeze one frame — no need to wait for a perfect hold.
              </p>
              <div
                id={READER_ID}
                className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-slate-800 bg-black/50"
              />
              <button
                type="button"
                className={`${BTN_GHOST} mt-4 w-full`}
                onClick={snapCurrentFrame}
                disabled={processing}
              >
                Decode snapshot
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
