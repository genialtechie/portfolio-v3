// Opt-in sound. Nothing is fetched until the visitor turns sound on, and
// browsers won't play audio before an interaction anyway, so the boot log
// stays silent. Turning sound on plays a short computer startup, then a lo-fi
// loop fades in. The loop gets quiet in the portfolio and stops in the arcade
// (Hoopzy has its own audio). Everything pauses when the tab is hidden.

export type Cue = "startup" | "click" | "seek" | "eject" | "tick" | "coin";
export type SoundScene = "room" | "macos" | "arcade";

const FILES: Record<Cue | "loop", string> = {
  loop: "/audio/lofi-loop.mp3",
  startup: "/audio/startup.mp3",
  click: "/audio/click.mp3",
  seek: "/audio/floppy-seek.mp3",
  eject: "/audio/floppy-eject.mp3",
  tick: "/audio/tick.mp3",
  coin: "/audio/coin.mp3",
};

// The loop file carries 0.3s of padding on each side, copied from the other
// end, so the seam stays clean whether or not a decoder trims MP3 padding.
const LOOP_START = 0.3;
const LOOP_LENGTH = 42.202449; // 16 bars at 91 BPM

const MUSIC_LEVEL: Record<SoundScene, number> = { room: 0.32, macos: 0.1, arcade: 0 };
const CUE_LEVEL: Record<Cue, number> = {
  startup: 0.9,
  click: 0.7,
  seek: 0.45,
  eject: 0.5,
  tick: 0.35,
  coin: 0.55,
};

const PREF_KEY = "sound.v1";

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) === "on";
  } catch {
    return false;
  }
}

function writePref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // Private mode: the toggle still works for this visit.
  }
}

export function createSound(onChange: (on: boolean) => void) {
  let on = readPref();
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let music: GainNode | null = null;
  let loopSource: AudioBufferSourceNode | null = null;
  let scene: SoundScene = "room";
  let musicHeld = false; // true while the startup sound plays
  const buffers = new Map<string, Promise<AudioBuffer | null>>();

  function load(name: Cue | "loop") {
    let p = buffers.get(name);
    if (!p && ctx) {
      const c = ctx;
      p = fetch(FILES[name])
        .then((r) => r.arrayBuffer())
        .then((b) => c.decodeAudioData(b))
        .catch(() => null);
      buffers.set(name, p);
    }
    return p ?? Promise.resolve(null);
  }

  function ensureContext() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.connect(ctx.destination);
    music = ctx.createGain();
    music.gain.value = 0;
    music.connect(master);
    return ctx;
  }

  function ramp(param: AudioParam, to: number, seconds: number) {
    if (!ctx) return;
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(to, t + seconds);
  }

  async function startLoop() {
    const buf = await load("loop");
    if (!buf || !ctx || !music || loopSource || !on) return;
    loopSource = ctx.createBufferSource();
    loopSource.buffer = buf;
    loopSource.loop = true;
    loopSource.loopStart = LOOP_START;
    loopSource.loopEnd = LOOP_START + LOOP_LENGTH;
    loopSource.connect(music);
    loopSource.start(0, LOOP_START);
    applyMusicLevel(2.5);
  }

  function applyMusicLevel(seconds = 0.6) {
    if (!music) return;
    const level = on && !musicHeld ? MUSIC_LEVEL[scene] : 0;
    ramp(music.gain, level, seconds);
  }

  async function play(cue: Cue) {
    if (!on || !ctx || !master || document.hidden) return;
    const buf = await load(cue);
    if (!buf || !ctx || !master) return;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = CUE_LEVEL[cue];
    src.buffer = buf;
    src.connect(gain).connect(master);
    src.start();
  }

  /** Must run inside a user gesture (click, tap or key). */
  async function enable(withStartup: boolean) {
    const c = ensureContext();
    if (!c || !master) return;
    await c.resume().catch(() => {});
    ramp(master.gain, 1, 0.05);
    // Small files first so the first interaction sound is ready quickly.
    for (const name of ["click", "tick", "seek", "eject", "coin"] as const) void load(name);
    if (withStartup) {
      musicHeld = true;
      void play("startup");
      // Let the startup do its thing, then bring the loop in under its tail.
      window.setTimeout(() => {
        musicHeld = false;
        applyMusicLevel(2.5);
      }, 2600);
    }
    void startLoop();
  }

  function disable() {
    if (!ctx || !master) return;
    ramp(master.gain, 0, 0.2);
    const c = ctx;
    window.setTimeout(() => {
      if (!on) void c.suspend().catch(() => {});
    }, 250);
  }

  // Returning visitors who left sound on: start the loop (no startup) on their
  // first interaction, since audio can't start before one.
  if (on) {
    const kick = () => {
      window.removeEventListener("pointerdown", kick, true);
      window.removeEventListener("keydown", kick, true);
      if (on) void enable(false);
    };
    window.addEventListener("pointerdown", kick, true);
    window.addEventListener("keydown", kick, true);
  }

  document.addEventListener("visibilitychange", () => {
    if (!ctx || !on) return;
    if (document.hidden) void ctx.suspend().catch(() => {});
    else void ctx.resume().catch(() => {});
  });

  return {
    get on() {
      return on;
    },
    toggle() {
      on = !on;
      writePref(on);
      if (on) void enable(true);
      else disable();
      onChange(on);
    },
    cue(name: Cue) {
      void play(name);
    },
    setScene(next: SoundScene) {
      scene = next;
      applyMusicLevel(next === "room" ? 1.2 : 0.5);
    },
  };
}
