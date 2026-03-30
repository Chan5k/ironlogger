import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const READER_ID = 'ironlog-barcode-reader';

const BTN_PRIMARY =
  'inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const BTN_GHOST =
  'inline-flex min-h-[48px] touch-manipulation items-center justify-center rounded-lg border border-slate-700 bg-slate-800/40 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800/70 active:bg-slate-800';

/**
 * Fullscreen barcode scanner (EAN / UPC) using html5-qrcode. Mobile-first; requires secure context (HTTPS or localhost).
 */
export default function BarcodeScannerModal({ open, onClose, onBarcodeScanned }) {
  const scannerRef = useRef(null);
  const lockedRef = useRef(false);
  const lastHitRef = useRef({ digits: '', t: 0 });
  const onBarcodeRef = useRef(onBarcodeScanned);
  const [uiError, setUiError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

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
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
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
        'This browser does not support camera capture here. Use Chrome or Safari on your phone, or add the food manually.'
      );
      return () => {
        alive = false;
      };
    }

    const run = async () => {
      try {
        const mod = await import('html5-qrcode');
        if (!alive) return;
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod;

        const html5 = new Html5Qrcode(READER_ID, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        });
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
          const digits = String(decodedText || '').replace(/\D/g, '');
          if (digits.length < 8 || digits.length > 14) return;
          const now = Date.now();
          const last = lastHitRef.current;
          if (last.digits === digits && now - last.t < 550) return;
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
          fps: 8,
          qrbox: (viewfinderW, viewfinderH) => {
            const w = Math.min(300, Math.floor(viewfinderW * 0.9));
            const h = Math.min(170, Math.floor(viewfinderH * 0.38));
            return { width: w, height: Math.max(80, h) };
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
          setUiError('Camera permission denied. Allow camera access in your browser settings, then tap Try again.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setUiError('No suitable camera was found. Add food manually or use text search.');
        } else {
          setUiError(msg || 'Could not start the camera. Add food manually if this keeps happening.');
        }
      }
    };

    const raf = window.requestAnimationFrame(() => {
      run();
    });

    return () => {
      alive = false;
      window.cancelAnimationFrame(raf);
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
  }, [open, retryKey]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex flex-col bg-[#0a0e14]"
      role="dialog"
      aria-modal
      aria-labelledby="barcode-scanner-title"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800/90 px-4 py-3 safe-pt">
        <div className="min-w-0">
          <h2 id="barcode-scanner-title" className="text-lg font-semibold text-white">
            Scan food barcode
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Point at the bars on packaged supermarket products (EAN-13). Works best on HTTPS.
          </p>
        </div>
        <button
          type="button"
          className="min-h-[48px] min-w-[48px] touch-manipulation rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {uiError ? (
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
            <button type="button" className={`${BTN_GHOST} w-full`} onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-center text-xs text-slate-400">
              Hold steady; scanning stops after one valid code. Cancel anytime with the X above.
            </p>
            <div
              id={READER_ID}
              className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-slate-800 bg-black/50"
            />
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
