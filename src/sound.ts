// Opt-in sound. Nothing is fetched until the visitor turns sound on.
// The computer startup sound only ever plays during the boot, and only when
// the browser already allows audio (it won't before the visitor interacts,
// except on sites they visit a lot). Otherwise a returning visitor who left
// sound on gets the loop on their first click, tap or key, and the status bar
// says so in the meantime. Turning sound on later just brings the loop in. The loop is very low in the
// portfolio and stops in the arcade (Hoopzy has its own audio). Everything
// pauses when the tab is hidden.

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

// Music sits under everything; interface sounds sit clearly on top.
const MUSIC_LEVEL: Record<SoundScene, number> = { room: 0.24, macos: 0.035, arcade: 0 };
const CUE_LEVEL: Record<Cue, number> = {
  startup: 0.9,
  click: 1,
  seek: 0.75,
  eject: 0.85,
  tick: 0.6,
  coin: 0.75,
};

/** When the startup's beep has played and the loop can come in under its tail. */
const STARTUP_LOOP_AT_MS = 2600;

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

/** `waiting`: sound is on, but the browser is holding audio until the first interaction. */
export type SoundState = "off" | "on" | "waiting";

export function createSound(onChange: (state: SoundState, fromUser: boolean) => void) {
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

  /** Must run inside a user gesture (click, tap or key), unless the browser already allows audio. */
  async function enable(withStartup: boolean) {
    const c = ensureContext();
    if (!c || !master) return;
    if (withStartup) {
      musicHeld = true;
      // Fetch the startup first: it's the sound the visitor is waiting on.
      void load("startup");
    }
    await c.resume().catch(() => {});
    ramp(master.gain, 1, 0.05);
    for (const name of ["click", "tick", "seek", "eject", "coin"] as const) void load(name);
    if (withStartup) {
      void play("startup");
      // Let the startup do its thing, then bring the loop in under its tail.
      window.setTimeout(() => {
        musicHeld = false;
        applyMusicLevel(2.5);
      }, STARTUP_LOOP_AT_MS);
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

  document.addEventListener("visibilitychange", () => {
    if (!ctx || !on) return;
    if (document.hidden) void ctx.suspend().catch(() => {});
    else void ctx.resume().catch(() => {});
  });

  return {
    get on() {
      return on;
    },
    /** Sound was left on: the boot should power on with the startup sound. */
    get wantsStartup() {
      return on;
    },
    /**
     * Whether audio can start right now without a gesture (some browsers allow
     * it on sites you visit often). If so the context is already running.
     */
    async canAutoplay() {
      const c = ensureContext();
      if (!c) return false;
      if (c.state === "running") return true;
      await Promise.race([c.resume().catch(() => {}), new Promise((r) => window.setTimeout(r, 120))]);
      return (c.state as AudioContextState) === "running";
    },
    /** The machine powers on: startup sound, then the loop. Call from a gesture. */
    powerOn() {
      if (on) void enable(true);
    },
    /** Sound on, but no boot to go with it (deep links): loop on the first interaction. */
    resumeOnFirstInteraction() {
      if (!on) return;
      onChange("waiting", false);
      const kick = (e: Event) => {
        window.removeEventListener("pointerdown", kick, true);
        window.removeEventListener("keydown", kick, true);
        // A click on the sound button itself is the toggle's job (it turns sound off).
        if ((e.target as Element | null)?.closest?.("#sound")) return;
        if (!on) return;
        void enable(false);
        onChange("on", false);
      };
      window.addEventListener("pointerdown", kick, true);
      window.addEventListener("keydown", kick, true);
    },
    toggle() {
      on = !on;
      writePref(on);
      if (on) {
        // Turning sound on mid-visit: no startup (that belongs to the boot),
        // just a click to confirm and the loop fading in.
        void enable(false).then(() => play("click"));
      } else disable();
      onChange(on ? "on" : "off", true);
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
