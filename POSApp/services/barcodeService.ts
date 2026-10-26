import React from 'react';
import { Camera, Frame, useCameraDevices } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';

export interface BarcodeResult {
  value: string;
  format: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

class BarcodeService {
  private camera: Camera | null = null;
  private isScanning = false;
  private onBarcodeScanned: ((barcode: string) => void) | null = null;

  setCamera(camera: Camera | null): void {
    this.camera = camera;
  }

  setBarcodeCallback(callback: (barcode: string) => void): void {
    this.onBarcodeScanned = callback;
  }

  startScanning(): void {
    if (this.camera && !this.isScanning) {
      this.isScanning = true;
      console.log('Barcode scanning started');
    }
  }

  stopScanning(): void {
    this.isScanning = false;
    console.log('Barcode scanning stopped');
  }

  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }

  // Frame processor for barcode detection
  async processFrame(frame: Frame): Promise<void> {
    if (!this.isScanning || !this.onBarcodeScanned) {
      return;
    }

    try {
      // In a real implementation, you would use a barcode detection library
      // like @react-native-vision-camera/barcode-scanner or VisionCameraBarcodeScanner
      // For now, we'll simulate barcode detection

      // This is where you would integrate actual barcode scanning
      // Example with a barcode scanning library:
      /*
      const barcodes = await scanBarcodes(frame);

      if (barcodes.length > 0) {
        runOnJS(this.handleBarcodeDetected)(barcodes[0].value);
      }
      */

    } catch (error) {
      console.error('Error processing frame for barcode detection:', error);
    }
  }

  private handleBarcodeDetected = (barcode: string): void => {
    if (this.onBarcodeScanned && this.isScanning) {
      this.onBarcodeScanned(barcode);
      // Optionally stop scanning after detection
      // this.stopScanning();
    }
  };

  // Manual barcode entry simulation
  simulateBarcodeDetection(barcode: string): void {
    if (this.onBarcodeScanned && this.isScanning) {
      this.handleBarcodeDetected(barcode);
    }
  }

  // Utility methods for barcode validation
  validateBarcode(barcode: string): boolean {
    // Basic validation - can be enhanced based on barcode types
    return typeof barcode === 'string' && barcode.length > 0;
  }

  formatBarcode(barcode: string): string {
    // Remove any whitespace and convert to uppercase
    return barcode.trim().toUpperCase();
  }

  // Common barcode formats
  getBarcodeFormatInfo(barcode: string): { type: string; description: string } {
    const length = barcode.length;

    if (length === 8 || length === 12 || length === 13) {
      return { type: 'EAN/UPC', description: 'Standard product barcode' };
    } else if (length === 14) {
      return { type: 'GTIN', description: 'Global Trade Item Number' };
    } else if (barcode.startsWith('0')) {
      return { type: 'Code 128', description: 'Alphanumeric barcode' };
    } else {
      return { type: 'Unknown', description: 'Unrecognized format' };
    }
  }

  // Generate test barcodes for development
  getTestBarcodes(): string[] {
    return [
      '1234567890123', // EAN-13
      '123456789',     // EAN-8
      '012345678905',  // UPC-A
      '123456789012',  // UPC-E
      'ABC123DEF456',  // Code 128
    ];
  }
}

export const barcodeService = new BarcodeService();

// React hook for barcode scanning
export const useBarcodeScanner = () => {
  const [isScanning, setIsScanning] = React.useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = React.useState<string | null>(null);

  const startScanning = React.useCallback((onBarcodeScanned: (barcode: string) => void) => {
    barcodeService.setBarcodeCallback(onBarcodeScanned);
    barcodeService.startScanning();
    setIsScanning(true);
  }, []);

  const stopScanning = React.useCallback(() => {
    barcodeService.stopScanning();
    setIsScanning(false);
  }, []);

  const simulateScan = React.useCallback((barcode: string) => {
    if (isScanning) {
      setLastScannedBarcode(barcode);
      barcodeService.simulateBarcodeDetection(barcode);
    }
  }, [isScanning]);

  React.useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return {
    isScanning,
    lastScannedBarcode,
    startScanning,
    stopScanning,
    simulateScan,
    setCamera: barcodeService.setCamera.bind(barcodeService),
  };
};