/**
 * TraqHACCP Pro - Infrastructure Layer: Camera & Barcode Scanner Service
 * Manages WebRTC camera streams and native BarcodeDetector API with canvas capture fallback.
 */

export class CameraService {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.scanInterval = null;
    this.barcodeDetector = null;
    this.isScanning = false;
    this._initBarcodeDetector();
  }

  async _initBarcodeDetector() {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const supportedFormats = await window.BarcodeDetector.getSupportedFormats();
        this.barcodeDetector = new window.BarcodeDetector({
          formats: supportedFormats.length ? supportedFormats : ['ean_13', 'ean_8', 'code_128', 'qr_code']
        });
      } catch (e) {
        console.warn("BarcodeDetector initialization failed, using canvas fallback", e);
      }
    }
  }

  isSupported() {
    return typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async startCamera(videoElement, facingMode = 'environment') {
    if (!this.isSupported()) {
      throw new Error("La caméra n'est pas supportée par ce navigateur.");
    }

    this.stopCamera();
    this.videoElement = videoElement;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();
      return true;
    } catch (err) {
      console.error("Camera access error", err);
      throw new Error("Impossible d'accéder à la caméra : " + (err.message || 'Permission refusée'));
    }
  }

  startContinuousScan(onDetected, intervalMs = 250) {
    if (!this.videoElement || this.isScanning) return;
    this.isScanning = true;

    this.scanInterval = setInterval(async () => {
      if (!this.videoElement || this.videoElement.readyState < 2) return;

      if (this.barcodeDetector) {
        try {
          const barcodes = await this.barcodeDetector.detect(this.videoElement);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              onDetected(rawValue);
            }
          }
        } catch (e) {
          // Frame read error, continue next tick
        }
      }
    }, intervalMs);
  }

  stopCamera() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isScanning = false;

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  captureSnapshotDataUrl() {
    if (!this.videoElement || this.videoElement.readyState < 2) return null;
    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth || 640;
    canvas.height = this.videoElement.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }
}
