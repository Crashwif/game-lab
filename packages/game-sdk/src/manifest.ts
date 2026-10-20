/**
 * The game bundle a creator publishes: a
 * manifest naming the theme, the assets by slot, the audio preset and how the
 * game is rendered. Outcomes never come from the bundle: every crash point is
 * the room's committed hash chain, so a bundle is presentation and
 * interaction only. A custom renderer runs in a sandboxed frame and reaches
 * the room only through the embed bridge (embed.ts).
 */

export const MANIFEST_VERSION = 1;

export const ASSET_SLOTS = ['background', 'character', 'effect', 'ui', 'icon', 'logo'] as const;
export type AssetSlot = (typeof ASSET_SLOTS)[number];

export const RENDERERS = ['builtin-curve', 'builtin-balloon', 'custom'] as const;
export type Renderer = (typeof RENDERERS)[number];

export const LICENCES = ['all-rights-reserved', 'derivatives-royalty', 'open'] as const;
export type Licence = (typeof LICENCES)[number];

/** The cues a bundle may carry as recorded clips: the music loop and the game events of @crashwif/game-audio. */
export const AUDIO_CLIPS = ['music', 'roundStart', 'betPlaced', 'multiplierTick', 'targetReached', 'crash', 'highMultiplier', 'rally', 'queued', 'passEnded'] as const;
export type AudioClip = (typeof AUDIO_CLIPS)[number];

export interface ThemeSpec {
  category: string;
  mood: string;
  /** CSS colours by role: background, curve, accent, text, crash. */
  colors: Record<string, string>;
}

export interface AudioSpec {
  /** A preset from @crashwif/game-audio, or 'none'. */
  preset: string;
  /** Optional per-event overrides by preset name. */
  events?: Partial<Record<'bet' | 'lock' | 'tick' | 'cashout' | 'crash' | 'rally', string>>;
  volume?: number;
  /** Bundle file path of a recorded clip by cue; the clip plays instead of the cue's synthesised sound, and `music` loops through each round. */
  clips?: Partial<Record<AudioClip, string>>;
}

export interface GameManifest {
  version: typeof MANIFEST_VERSION;
  name: string;
  description: string;
  /** The royalty-free template the game started from, if any. */
  templateId: string | null;
  theme: ThemeSpec;
  /** Bundle file path by asset slot; the file's sha256 is in the bundle's file list. */
  assets: Partial<Record<AssetSlot, string>>;
  /** A preview frame used as the room's lobby and sharing image. */
  cover?: string;
  audio: AudioSpec;
  renderer: Renderer;
  /** For a custom renderer: the HTML entry inside the bundle. */
  entry?: string;
  licence: Licence;
  /** For 'derivatives-royalty': basis points of each pass price owed to this game by games built on it. */
  royaltyBps?: number;
  /** The published bundle this game is built on, declared by the creator. */
  derivativeOf?: string | null;
}

const NAME = /^[\p{L}\p{N}][\p{L}\p{N} '._-]{0,63}$/u;
const PATH = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._\-/]{1,200}$/;
const COLOR = /^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$|^rgba?\([0-9., %]+\)$|^[a-z]{3,20}$/;

export interface ManifestProblem {
  path: string;
  message: string;
}

/** Checks a manifest's shape and rules; the bundle's files are checked separately against `assets` and `entry`. */
export function validateManifest(raw: unknown): { ok: true; manifest: GameManifest; problems: [] } | { ok: false; problems: ManifestProblem[] } {
  const problems: ManifestProblem[] = [];
  const m = (raw ?? {}) as Record<string, unknown>;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, problems: [{ path: '', message: 'manifest must be an object' }] };
  if (m.version !== MANIFEST_VERSION) problems.push({ path: 'version', message: `version must be ${MANIFEST_VERSION}` });
  if (typeof m.name !== 'string' || !NAME.test(m.name)) problems.push({ path: 'name', message: 'name is 1 to 64 letters, digits, spaces or basic punctuation' });
  if (typeof m.description !== 'string' || m.description.length > 1000) problems.push({ path: 'description', message: 'description is at most 1,000 characters' });
  if (m.templateId !== null && m.templateId !== undefined && (typeof m.templateId !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(m.templateId))) problems.push({ path: 'templateId', message: 'templateId is a template id or null' });
  const theme = (m.theme ?? {}) as Record<string, unknown>;
  if (typeof m.theme !== 'object' || m.theme === null) problems.push({ path: 'theme', message: 'theme is required' });
  else {
    if (typeof theme.category !== 'string' || theme.category.length === 0 || theme.category.length > 32) problems.push({ path: 'theme.category', message: 'category is required' });
    if (typeof theme.mood !== 'string' || theme.mood.length === 0 || theme.mood.length > 32) problems.push({ path: 'theme.mood', message: 'mood is required' });
    const colors = theme.colors as Record<string, unknown> | undefined;
    if (typeof colors !== 'object' || colors === null) problems.push({ path: 'theme.colors', message: 'colors is an object of CSS colours by role' });
    else {
      for (const [role, value] of Object.entries(colors)) {
        if (!/^[a-z]{1,20}$/.test(role) || typeof value !== 'string' || !COLOR.test(value)) problems.push({ path: `theme.colors.${role}`, message: 'a CSS colour (hex, rgb() or a name) by a lowercase role' });
      }
    }
  }
  const assets = (m.assets ?? {}) as Record<string, unknown>;
  if (typeof m.assets !== 'object' || m.assets === null) problems.push({ path: 'assets', message: 'assets maps slots to bundle paths' });
  else {
    for (const [slot, path] of Object.entries(assets)) {
      if (!(ASSET_SLOTS as readonly string[]).includes(slot)) problems.push({ path: `assets.${slot}`, message: `unknown slot; one of ${ASSET_SLOTS.join(', ')}` });
      else if (typeof path !== 'string' || !PATH.test(path)) problems.push({ path: `assets.${slot}`, message: 'a relative path inside the bundle' });
    }
  }
  if (m.cover !== undefined && (typeof m.cover !== 'string' || !PATH.test(m.cover) || m.cover.startsWith('/') || m.cover.includes('//'))) problems.push({ path: 'cover', message: 'a relative image path inside the bundle' });
  const audio = (m.audio ?? {}) as Record<string, unknown>;
  if (typeof m.audio !== 'object' || m.audio === null || typeof audio.preset !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(audio.preset)) problems.push({ path: 'audio.preset', message: 'audio.preset names a preset (or "none")' });
  if (audio.volume !== undefined && (typeof audio.volume !== 'number' || audio.volume < 0 || audio.volume > 1)) problems.push({ path: 'audio.volume', message: 'volume is 0 to 1' });
  if (audio.clips !== undefined) {
    if (typeof audio.clips !== 'object' || audio.clips === null || Array.isArray(audio.clips)) problems.push({ path: 'audio.clips', message: 'clips maps cues to bundle paths' });
    else {
      for (const [cue, path] of Object.entries(audio.clips as Record<string, unknown>)) {
        if (!(AUDIO_CLIPS as readonly string[]).includes(cue)) problems.push({ path: `audio.clips.${cue}`, message: `unknown cue; one of ${AUDIO_CLIPS.join(', ')}` });
        else if (typeof path !== 'string' || !PATH.test(path)) problems.push({ path: `audio.clips.${cue}`, message: 'a relative path inside the bundle' });
      }
    }
  }
  if (!(RENDERERS as readonly string[]).includes(m.renderer as string)) problems.push({ path: 'renderer', message: `renderer is one of ${RENDERERS.join(', ')}` });
  if (m.renderer === 'custom' && (typeof m.entry !== 'string' || !PATH.test(m.entry) || !/\.html$/.test(m.entry))) problems.push({ path: 'entry', message: 'a custom renderer names its HTML entry inside the bundle' });
  if (m.renderer !== 'custom' && m.entry !== undefined) problems.push({ path: 'entry', message: 'only a custom renderer has an entry' });
  if (!(LICENCES as readonly string[]).includes(m.licence as string)) problems.push({ path: 'licence', message: `licence is one of ${LICENCES.join(', ')}` });
  if (m.licence === 'derivatives-royalty') {
    if (!Number.isInteger(m.royaltyBps) || (m.royaltyBps as number) < 0 || (m.royaltyBps as number) > 1_000) problems.push({ path: 'royaltyBps', message: 'royaltyBps is 0 to 1000 (up to 10% of each pass price)' });
  } else if (m.royaltyBps !== undefined && m.royaltyBps !== 0) problems.push({ path: 'royaltyBps', message: 'only a derivatives-royalty licence sets a royalty' });
  if (m.derivativeOf !== undefined && m.derivativeOf !== null && (typeof m.derivativeOf !== 'string' || !/^[0-9a-f-]{36}$/i.test(m.derivativeOf))) problems.push({ path: 'derivativeOf', message: 'derivativeOf is a published bundle id or null' });
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    manifest: {
      version: MANIFEST_VERSION,
      name: m.name as string,
      description: m.description as string,
      templateId: (m.templateId as string | undefined) ?? null,
      theme: { category: theme.category as string, mood: theme.mood as string, colors: { ...(theme.colors as Record<string, string>) } },
      assets: { ...(assets as Partial<Record<AssetSlot, string>>) },
      ...(m.cover !== undefined ? { cover: m.cover as string } : {}),
      audio: {
        preset: audio.preset as string,
        ...(audio.events ? { events: audio.events as AudioSpec['events'] } : {}),
        ...(audio.volume !== undefined ? { volume: audio.volume as number } : {}),
        ...(audio.clips ? { clips: { ...(audio.clips as AudioSpec['clips']) } } : {}),
      },
      renderer: m.renderer as Renderer,
      ...(m.renderer === 'custom' ? { entry: m.entry as string } : {}),
      licence: m.licence as Licence,
      ...(m.licence === 'derivatives-royalty' ? { royaltyBps: m.royaltyBps as number } : {}),
      derivativeOf: (m.derivativeOf as string | undefined) ?? null,
    },
    problems: [],
  };
}

/** JSON with keys sorted at every level: the bytes a bundle's content hash covers. */
export function canonicalManifest(manifest: GameManifest): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, sort(x)])) : v;
  return JSON.stringify(sort(manifest));
}
