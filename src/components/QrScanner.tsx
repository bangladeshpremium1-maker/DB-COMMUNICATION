import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';

export function QrScanner({ onScan, onClose }: { onScan: (text: string) => void, onClose: () => void }) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!qrRef.current) return;
    
    // Create instance
    const html5QrCode = new Html5Qrcode("qr-reader");

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        // Success
        html5QrCode.stop().then(() => {
          onScan(decodedText);
        }).catch(err => console.error("Failed to stop scanner", err));
      },
      (errorMessage) => {
        // Parse error, ignore frame errors
      }
    ).catch(err => {
      setError("Failed to start camera. Please check permissions.");
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="absolute inset-0 bg-[#f0f2f5] z-30 flex flex-col animate-in slide-in-from-bottom duration-200">
      <div className="h-[100px] bg-[#008069] flex items-end px-4 pb-4 flex-shrink-0">
        <button onClick={onClose} className="text-white hover:text-[#d9fdd3] mr-6">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-medium text-white">Scan QR Code</h2>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : (
          <div className="w-full max-w-sm rounded-lg overflow-hidden shadow-lg border-4 border-[#00a884]">
            <div id="qr-reader" ref={qrRef} className="w-full"></div>
          </div>
        )}
        <p className="text-[#54656f] text-sm mt-8 text-center max-w-xs">
          Point your camera at a friend's QR code to find them instantly.
        </p>
      </div>
    </div>
  );
}
