/** Petits bruitages synthétisés (pas de musique) : bips de menu, coups, Poké Ball, montée de niveau. */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Les navigateurs n'autorisent le son qu'après une action du joueur. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.25;
    this.master.connect(this.ctx.destination);
  }

  select(): void {
    this.tone(1320, 0.05, 'square', 0.3);
  }

  bump(): void {
    this.tone(110, 0.08, 'square', 0.4);
  }

  /** Coup reçu : plus fort si c'est super efficace. */
  hit(strong = false): void {
    this.noise(strong ? 0.25 : 0.15, strong ? 1 : 0.7);
  }

  faint(): void {
    this.sweep(600, 120, 0.5, 'square', 0.35);
  }

  throwBall(): void {
    this.sweep(300, 900, 0.25, 'triangle', 0.4);
  }

  shake(): void {
    this.tone(220, 0.06, 'square', 0.35);
  }

  caught(): void {
    this.melody([784, 988, 1175, 1568], 0.09);
  }

  levelUp(): void {
    this.melody([523, 659, 784, 1047], 0.1);
  }

  /** Soin chez maman. */
  heal(): void {
    this.melody([659, 784, 659, 784, 1047], 0.12);
  }

  encounter(): void {
    this.melody([392, 523, 392, 523, 659], 0.06);
  }

  statUp(): void {
    this.sweep(400, 1200, 0.3, 'triangle', 0.3);
  }

  statDown(): void {
    this.sweep(1200, 400, 0.3, 'triangle', 0.3);
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0): void {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private sweep(from: number, to: number, duration: number, type: OscillatorType, volume: number): void {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noise(duration: number, volume: number): void {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain).connect(master);
    source.start();
  }

  private melody(notes: number[], step: number): void {
    notes.forEach((note, i) => this.tone(note, step * 1.6, 'square', 0.25, i * step));
  }
}
