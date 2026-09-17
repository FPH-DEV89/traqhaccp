/**
 * TraqHACCP Pro - Infrastructure Layer: Audio Service
 * Clean Architecture - Audio Adapter with Tone.js & Web Audio API Fallback
 */

export class AudioService {
  constructor() {
    this.synth = null;
    this.audioCtx = null;
  }

  _initTone() {
    try {
      if (typeof window !== 'undefined' && window.Tone && !this.synth) {
        window.Tone.start();
        this.synth = new window.Tone.Synth().toDestination();
        this.synth.volume.value = -10;
      }
    } catch (e) {
      // Audio context policy
    }
  }

  play(type = 'success') {
    try {
      // Vibration haptique sur mobile (Android / navigateurs supportés)
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        if (type === 'success') {
          navigator.vibrate(50);
        } else if (type === 'warning') {
          navigator.vibrate([70, 50, 70]);
        } else if (type === 'danger') {
          navigator.vibrate([100, 50, 100, 50, 200]);
        } else if (type === 'beep') {
          navigator.vibrate(30);
        }
      }

      this._initTone();
      if (this.synth) {
        if (type === 'success') {
          this.synth.triggerAttackRelease("C5", "16n");
          setTimeout(() => this.synth.triggerAttackRelease("G5", "16n"), 100);
        } else if (type === 'warning') {
          this.synth.triggerAttackRelease("F4", "8n");
          setTimeout(() => this.synth.triggerAttackRelease("D4", "8n"), 140);
        } else if (type === 'danger') {
          this.synth.triggerAttackRelease("A3", "8n");
          setTimeout(() => this.synth.triggerAttackRelease("Eb3", "8n"), 150);
          setTimeout(() => this.synth.triggerAttackRelease("C3", "4n"), 300);
        } else if (type === 'beep') {
          this.synth.triggerAttackRelease("B4", "32n");
        }
      }
    } catch (e) {
      // Non-blocking
    }
  }
}
