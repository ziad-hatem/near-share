import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: any) => void;
}

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Prevent double init
    if (scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );
    
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        // Stop scanning after success if needed, or just callback
        onScan(decodedText);
        scanner.clear().catch(console.error);
      },
      (errorMessage) => {
        if (onError) onError(errorMessage);
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [onScan, onError]);

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden rounded-lg bg-black">
      <div id="reader" className="w-full h-full" />
    </div>
  );
}
