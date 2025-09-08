export interface CapturedImage {
  dataURL: string;
  blob: Blob;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

export class ImageCapture {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  captureFromVideo(videoElement: HTMLVideoElement): CapturedImage | null {
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return null;
    }

    const { videoWidth, videoHeight } = videoElement;
    
    // Set canvas size to match video
    this.canvas.width = videoWidth;
    this.canvas.height = videoHeight;

    // Draw current video frame to canvas
    this.ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

    // Get image data
    const dataURL = this.canvas.toDataURL('image/jpeg', 0.8);
    const base64 = dataURL.split(',')[1];
    
    // Convert to blob for additional processing if needed
    return new Promise<CapturedImage>((resolve) => {
      this.canvas.toBlob((blob) => {
        if (blob) {
          resolve({
            dataURL,
            blob,
            base64,
            mimeType: 'image/jpeg',
            width: videoWidth,
            height: videoHeight
          });
        }
      }, 'image/jpeg', 0.8);
    }) as any;
  }

  captureFromVideoSync(videoElement: HTMLVideoElement): CapturedImage | null {
    try {
      if (!videoElement) {
        console.warn("No video element provided");
        return null;
      }
      
      if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        console.warn("Video element has zero dimensions:", videoElement.videoWidth, "x", videoElement.videoHeight);
        return null;
      }

      if (videoElement.readyState < 2) {
        console.warn("Video element not ready:", videoElement.readyState);
        return null;
      }

      const { videoWidth, videoHeight } = videoElement;
      
      // Set canvas size to match video
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;

      // Draw current video frame to canvas
      this.ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

      // Get image data
      const dataURL = this.canvas.toDataURL('image/jpeg', 0.8);
      if (!dataURL || !dataURL.startsWith('data:image/jpeg')) {
        console.error("Failed to generate valid data URL");
        return null;
      }
      
      const base64 = dataURL.split(',')[1];
      if (!base64 || base64.length === 0) {
        console.error("Failed to extract base64 data");
        return null;
      }
      
      return {
        dataURL,
        blob: null as any, // Will be null for sync version
        base64,
        mimeType: 'image/jpeg',
        width: videoWidth,
        height: videoHeight
      };
    } catch (error) {
      console.error("Error capturing image from video:", error);
      return null;
    }
  }

  enhanceImageForOCR(videoElement: HTMLVideoElement): CapturedImage | null {
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return null;
    }

    const { videoWidth, videoHeight } = videoElement;
    
    // Reduce image size to save tokens - max 800px width
    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / videoWidth);
    const scaledWidth = Math.floor(videoWidth * scale);
    const scaledHeight = Math.floor(videoHeight * scale);
    
    // Set canvas size to scaled dimensions
    this.canvas.width = scaledWidth;
    this.canvas.height = scaledHeight;

    // Draw current video frame to canvas with scaling
    this.ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight, 0, 0, scaledWidth, scaledHeight);

    // Apply image enhancements for better text recognition
    const imageData = this.ctx.getImageData(0, 0, scaledWidth, scaledHeight);
    const data = imageData.data;

    // Simple contrast and brightness enhancement
    for (let i = 0; i < data.length; i += 4) {
      // Increase contrast
      const contrast = 1.5;
      const brightness = 10;
      
      data[i] = Math.min(255, Math.max(0, contrast * (data[i] - 128) + 128 + brightness));     // Red
      data[i + 1] = Math.min(255, Math.max(0, contrast * (data[i + 1] - 128) + 128 + brightness)); // Green
      data[i + 2] = Math.min(255, Math.max(0, contrast * (data[i + 2] - 128) + 128 + brightness)); // Blue
    }

    this.ctx.putImageData(imageData, 0, 0);

    // Get enhanced image data
    const dataURL = this.canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataURL.split(',')[1];
    
    return {
      dataURL,
      blob: null as any,
      base64,
      mimeType: 'image/jpeg',
      width: scaledWidth,
      height: scaledHeight
    };
  }

  cleanup() {
    // Clean up canvas if needed
    this.canvas.remove();
  }
}