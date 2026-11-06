/**
 * Main Application Workflow Controller
 * 
 * Location: .project-brain/simulation-sandbox/pac-001/src/lib/app.js
 * Domain Governance: Domain B (Product Intelligence) & Domain H (Technical Construction)
 * 
 * Implements the full 8-step user conversion workflow:
 * 1. User selects or drops SVG file.
 * 2. Validates input (MIME, XML structure, size).
 * 3. Previews sanitized SVG in UI.
 * 4. User selects quality (0.1 - 1.0) and resolution scale (1x - 4x).
 * 5. Converts SVG to WebP locally in-browser via Canvas.
 * 6. User downloads resulting WebP with proper filename.
 * 7. Communicates status and errors via ARIA live regions and UI toasts.
 * 8. Cleans up object URLs and memory on reset or file replacement.
 */

import { sanitizeSvg } from './svg-sanitizer.js';
import { convertSvgToWebp } from './converter-engine.js';
import { announceStatus, formatBytes } from './accessibility.js';

export class SvgToWebpApp {
  constructor(domElements = {}) {
    this.elements = domElements;
    this.currentSvgRaw = null;
    this.currentSanitizedSvg = null;
    this.currentFileName = 'image';
    this.currentOriginalSize = 0;
    this.currentWebpResult = null;
    this.currentPreviewBlobUrl = null;
    this.isProcessing = false;
  }

  /**
   * Initializes application listeners and binds UI controls.
   */
  init() {
    const { dropzone, fileInput, qualitySlider, qualityValue, scaleSelect, convertBtn, downloadBtn, resetBtn } = this.elements;

    if (!dropzone || !fileInput) return;

    // 1. Drag & Drop Listeners
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-indigo-500', 'bg-indigo-50/10');
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/10');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/10');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFile(files[0]);
      }
    });

    // 2. Keyboard Access for Dropzone
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    // 3. File Input Listener
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        this.handleFile(files[0]);
      }
    });

    // 4. Quality Slider Listener
    if (qualitySlider && qualityValue) {
      qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = `${Math.round(qualitySlider.value * 100)}%`;
        if (this.currentSanitizedSvg) {
          this.convert();
        }
      });
    }

    // 5. Scale Selector Listener
    if (scaleSelect) {
      scaleSelect.addEventListener('change', () => {
        if (this.currentSanitizedSvg) {
          this.convert();
        }
      });
    }

    // 6. Action Buttons
    if (convertBtn) {
      convertBtn.addEventListener('click', () => this.convert());
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.download());
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.reset());
    }
  }

  /**
   * Processes chosen file, validates MIME/extension, sanitizes, and renders preview.
   * @param {File} file 
   */
  async handleFile(file) {
    if (!file) return;

    // MIME and Extension Validation
    const isSvgMime = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    if (!isSvgMime) {
      this.showError('INVALID_FORMAT: Please select a valid .svg file.');
      announceStatus('Error: Invalid file format. Please select an SVG file.', 'assertive');
      return;
    }

    this.currentOriginalSize = file.size;
    this.currentFileName = file.name.replace(/\.svg$/i, '') || 'image';

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      this.loadSvgContent(content);
    };
    reader.onerror = () => {
      this.showError('FILE_READ_ERROR: Could not read local file.');
      announceStatus('Error: Could not read local file.', 'assertive');
    };
    reader.readAsText(file);
  }

  /**
   * Validates raw SVG text, sanitizes, and populates preview.
   * @param {string} rawSvg 
   */
  loadSvgContent(rawSvg) {
    this.cleanupActiveResults();
    this.hideError();

    const result = sanitizeSvg(rawSvg);
    if (!result.isValid) {
      this.showError(result.error || 'Failed to parse SVG markup.');
      announceStatus(`Error: ${result.error}`, 'assertive');
      return;
    }

    this.currentSvgRaw = rawSvg;
    this.currentSanitizedSvg = result.sanitizedSvg;

    // Update Preview Container safely via isolated <img> and Blob URL (SEC-05)
    const { previewContainer, previewDetails, controlsSection, actionsSection } = this.elements;
    if (this.currentPreviewBlobUrl) {
      URL.revokeObjectURL(this.currentPreviewBlobUrl);
      this.currentPreviewBlobUrl = null;
    }
    const previewBlob = new Blob([result.sanitizedSvg], { type: 'image/svg+xml;charset=utf-8' });
    this.currentPreviewBlobUrl = URL.createObjectURL(previewBlob);

    if (previewContainer) {
      previewContainer.innerHTML = '';
      const img = document.createElement('img');
      img.src = this.currentPreviewBlobUrl;
      img.alt = 'Vector SVG Preview';
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'contain';
      img.setAttribute('role', 'img');
      previewContainer.appendChild(img);
      previewContainer.setAttribute('aria-hidden', 'false');
    }

    if (previewDetails) {
      previewDetails.textContent = `Original: ${result.width}×${result.height}px (${formatBytes(this.currentOriginalSize)})`;
    }

    if (controlsSection) controlsSection.classList.remove('hidden');
    if (actionsSection) actionsSection.classList.remove('hidden');

    announceStatus(`SVG loaded successfully. Dimensions: ${result.width} by ${result.height} pixels. Ready for conversion.`, 'polite');

    // Trigger auto-conversion on load
    this.convert();
  }

  /**
   * Executes SVG to WebP rasterization.
   */
  async convert() {
    if (!this.currentSanitizedSvg || this.isProcessing) return;

    this.isProcessing = true;
    const { qualitySlider, scaleSelect, statusIndicator, downloadBtn } = this.elements;

    const quality = qualitySlider ? Number(qualitySlider.value) : 0.85;
    const scale = scaleSelect ? Number(scaleSelect.value) : 1.0;

    if (statusIndicator) {
      statusIndicator.textContent = 'Converting SVG to WebP in browser memory...';
      statusIndicator.classList.remove('hidden');
    }

    try {
      this.cleanupActiveResults();

      const result = await convertSvgToWebp(this.currentSanitizedSvg, { quality, scale });
      this.currentWebpResult = result;

      if (statusIndicator) {
        const savingsPercent = this.currentOriginalSize > 0
          ? Math.round((1 - (result.sizeBytes / this.currentOriginalSize)) * 100)
          : 0;
        
        statusIndicator.textContent = `Conversion Complete: ${result.width}×${result.height}px | WebP Size: ${formatBytes(result.sizeBytes)} (${savingsPercent >= 0 ? `${savingsPercent}% smaller` : `${Math.abs(savingsPercent)}% larger`})`;
      }

      if (downloadBtn) {
        downloadBtn.removeAttribute('disabled');
        downloadBtn.focus();
      }

      announceStatus(`Conversion complete. WebP output size is ${formatBytes(result.sizeBytes)}.`, 'polite');
    } catch (err) {
      this.showError(`Conversion Failed: ${err.message}`);
      announceStatus(`Conversion failed: ${err.message}`, 'assertive');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Triggers download of generated WebP image.
   */
  download() {
    if (!this.currentWebpResult || !this.currentWebpResult.url) return;

    const link = document.createElement('a');
    link.href = this.currentWebpResult.url;
    link.download = `${this.currentFileName}.webp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    announceStatus(`Downloaded ${this.currentFileName}.webp successfully.`, 'polite');
  }

  /**
   * Cleans up active Object URLs and resets memory.
   */
  cleanupActiveResults() {
    if (this.currentPreviewBlobUrl) {
      URL.revokeObjectURL(this.currentPreviewBlobUrl);
      this.currentPreviewBlobUrl = null;
    }
    if (this.currentWebpResult && typeof this.currentWebpResult.cleanup === 'function') {
      this.currentWebpResult.cleanup();
      this.currentWebpResult = null;
    }
  }

  /**
   * Resets application state and clears UI.
   */
  reset() {
    this.cleanupActiveResults();
    this.currentSvgRaw = null;
    this.currentSanitizedSvg = null;
    this.currentFileName = 'image';
    this.currentOriginalSize = 0;

    const { previewContainer, previewDetails, statusIndicator, controlsSection, actionsSection, fileInput } = this.elements;

    if (previewContainer) previewContainer.innerHTML = '<span class="text-slate-400 text-sm">No SVG Loaded</span>';
    if (previewDetails) previewDetails.textContent = '';
    if (statusIndicator) statusIndicator.textContent = '';
    if (controlsSection) controlsSection.classList.add('hidden');
    if (actionsSection) actionsSection.classList.add('hidden');
    if (fileInput) fileInput.value = '';

    this.hideError();
    announceStatus('Application reset. Ready for new SVG file.', 'polite');
  }

  showError(msg) {
    const { errorBanner } = this.elements;
    if (errorBanner) {
      errorBanner.textContent = msg;
      errorBanner.classList.remove('hidden');
    }
  }

  hideError() {
    const { errorBanner } = this.elements;
    if (errorBanner) {
      errorBanner.textContent = '';
      errorBanner.classList.add('hidden');
    }
  }
}

