const STORAGE_KEY = 'terbumtanAudioSettings'
const defaults = { master: 0.8, effects: 0.8, music: 0.22, muted: false }


class AudioManager {
  constructor() {
    this.settings = { ...defaults, ...this.readSettings() }
    this.context = null
    this.masterGain = null
    this.effectsGain = null
    this.musicGain = null
    this.musicTimer = null
    this.duckTimer = null
    this.lastEffectAt = new Map()
  }

  readSettings() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} } }
  saveSettings() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings)) }
  getSettings() { return { ...this.settings } }
  setSettings(next) { this.settings = { ...this.settings, ...next }; this.saveSettings(); this.applyGains() }

  ensure() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext
      if (!Context) return false
      this.context = new Context()
      this.masterGain = this.context.createGain()
      this.effectsGain = this.context.createGain()
      this.musicGain = this.context.createGain()
      this.effectsGain.connect(this.masterGain); this.musicGain.connect(this.masterGain); this.masterGain.connect(this.context.destination)
      this.applyGains()
    }
    if (this.context.state === 'suspended') this.context.resume()
    return true
  }
  applyGains() {
    if (!this.masterGain) return
    const now = this.context.currentTime
    this.masterGain.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, now, 0.02)
    this.effectsGain.gain.setTargetAtTime(this.settings.effects, now, 0.02)
    this.musicGain.gain.setTargetAtTime(this.settings.music, now, 0.08)
  }
  duck() {
    if (!this.musicGain) return
    const now = this.context.currentTime
    this.musicGain.gain.cancelScheduledValues(now); this.musicGain.gain.setTargetAtTime(this.settings.music * 0.28, now, 0.02)
    clearTimeout(this.duckTimer)
    this.duckTimer = setTimeout(() => { if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.settings.music, this.context.currentTime, 0.18) }, 650)
  }
  tone(frequency, duration = 0.12, type = 'sine', volume = 0.12, delay = 0) {
    if (!this.ensure()) return
    const now = this.context.currentTime + delay
    const osc = this.context.createOscillator(); const gain = this.context.createGain()
    osc.type = type; osc.frequency.setValueAtTime(frequency, now)
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain); gain.connect(this.effectsGain); osc.start(now); osc.stop(now + duration + 0.03)
  }
  noise(duration = 0.2, volume = 0.1, filterFrequency = 1600, delay = 0) {
    if (!this.ensure()) return
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration)); const buffer = this.context.createBuffer(1, length, this.context.sampleRate); const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
    const source = this.context.createBufferSource(); const filter = this.context.createBiquadFilter(); const gain = this.context.createGain(); const now = this.context.currentTime + delay
    filter.type = 'bandpass'; filter.frequency.value = filterFrequency; filter.Q.value = 0.8; gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(this.effectsGain); source.start(now)
  }
  play(name) {
    const now = performance.now(); if (now - (this.lastEffectAt.get(name) || 0) < 55) return; this.lastEffectAt.set(name, now); if (!this.ensure()) return; this.duck()
    if (name === 'dice-roll') { for (let i = 0; i < 8; i += 1) this.noise(0.13, 0.08, 850 + i * 120, i * 0.13); return }
    if (name === 'dice-land') { this.tone(105, 0.12, 'triangle', 0.18); this.tone(165, 0.16, 'sine', 0.11, 0.07); return }
    if (name === 'move') { this.tone(210, 0.07, 'triangle', 0.055); return }
    if (name === 'buy') { this.tone(440, 0.12, 'triangle', 0.12); this.tone(660, 0.18, 'triangle', 0.1, 0.08); return }
    if (name === 'money') { [660, 880, 1175].forEach((f, i) => this.tone(f, 0.13, 'sine', 0.08, i * 0.07)); return }
    if (name === 'pay') { this.tone(240, 0.16, 'sine', 0.08); this.tone(180, 0.18, 'sine', 0.06, 0.09); return }
    if (name === 'start') { [523, 659, 784].forEach((f, i) => this.tone(f, 0.24, 'triangle', 0.08, i * 0.1)); return }
    if (name === 'jail') { this.tone(180, 0.28, 'sawtooth', 0.07); this.tone(110, 0.32, 'sawtooth', 0.05, 0.1); return }
    if (name === 'vacation') { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.07, i * 0.08)); return }
    if (name === 'card') { this.noise(0.12, 0.08, 2400); this.tone(520, 0.12, 'triangle', 0.06, 0.08); return }
    if (name === 'win') { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, i * 0.12)); return }
    if (name === 'click') this.tone(320, 0.045, 'triangle', 0.045)
  }
  startMusic() {
    if (!this.ensure() || this.musicTimer) return
    const notes = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23]; let index = 0
    const tick = () => { if (!this.musicGain) return; this.toneMusic(notes[index % notes.length]); index += 1 }
    tick(); this.musicTimer = setInterval(tick, 760)
  }
  toneMusic(frequency) {
    const now = this.context.currentTime; const osc = this.context.createOscillator(); const gain = this.context.createGain(); osc.type = 'sine'; osc.frequency.value = frequency; gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.08, now + 0.08); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.68); osc.connect(gain); gain.connect(this.musicGain); osc.start(now); osc.stop(now + 0.72)
  }
}

export const audioManager = new AudioManager()
