/**
 * Playback position for embedded players. Cross-origin players can't be
 * inspected, so the position is only known for players that report it
 * (VidLink's documented PLAYER_EVENT messages, which other embeds copy).
 */
import type { ContinueItem, Kind } from './sync/types';

/** A point in an episode or movie, in seconds. */
export interface Position {
  time: number;
  duration?: number;
}

/** Below this a resume point isn't worth offering. */
export const MIN_RESUME_S = 30;

const MAX_LENGTH_S = 6 * 3600;

/** In the closing credits: the last ~4% of the length, 1–5 minutes. */
export function isFinished(time: number, duration?: number): boolean {
  if (!duration || duration <= 0) return false;
  return time >= duration - Math.max(60, Math.min(300, duration * 0.04));
}

/** Where to resume a saved entry, if it is for this episode (movies: any). */
export function resumePoint(
  entry: ContinueItem | undefined,
  kind: Kind,
  season: number,
  episode: number
): Position | null {
  if (!entry || entry.time == null) return null;
  if (kind === 'tv' && (entry.season !== season || (entry.episode ?? 1) !== episode)) return null;
  if (entry.time < MIN_RESUME_S || isFinished(entry.time, entry.duration)) return null;
  return { time: entry.time, duration: entry.duration };
}

/** 684 → "11:24", 4500 → "1:15:00". */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export interface PlayerProgress {
  time: number;
  duration: number;
  event: 'play' | 'pause' | 'seeked' | 'ended' | 'timeupdate';
  /** The episode the player says it is on (TV, when reported). */
  season?: number;
  episode?: number;
}

const positiveInt = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};

/**
 * Reads a player's progress report:
 * `{ type: 'PLAYER_EVENT', data: { event, currentTime, duration, mtmdbId, season, episode } }`.
 * Anything else — or a report for another title — is null. The episode is
 * passed on: players can move to another episode by themselves.
 */
export function readProgress(raw: unknown, expect: { tmdbId: number }): PlayerProgress | null {
  let msg = raw;
  if (typeof msg === 'string') {
    if (!msg.includes('PLAYER_EVENT')) return null;
    try {
      msg = JSON.parse(msg);
    } catch {
      return null;
    }
  }
  if (!msg || typeof msg !== 'object' || (msg as { type?: unknown }).type !== 'PLAYER_EVENT') {
    return null;
  }
  const data = (msg as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const time = Number(d.currentTime);
  const duration = Number(d.duration);
  if (
    !Number.isFinite(time) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > MAX_LENGTH_S ||
    time < 0 ||
    time > duration + 5
  ) {
    return null;
  }
  const id = Number(d.mtmdbId ?? d.tmdbId ?? d.tmdb_id);
  if (Number.isFinite(id) && id > 0 && id !== expect.tmdbId) return null;
  const season = positiveInt(d.season);
  const episode = positiveInt(d.episode);
  const name = String(d.event ?? '').toLowerCase();
  const event: PlayerProgress['event'] = name.includes('pause')
    ? 'pause'
    : name.includes('end')
      ? 'ended'
      : name.includes('seek')
        ? 'seeked'
        : name === 'play'
          ? 'play'
          : 'timeupdate';
  return {
    time: Math.min(time, duration),
    duration,
    event,
    ...(season != null && episode != null && episode > 0 ? { season, episode } : {}),
  };
}

/**
 * True if a message came from the player frame itself, or from the player's
 * own site (players that post from an inner frame). Ad frames inside the
 * player are on other sites and are ignored.
 */
export function fromPlayerFrame(e: MessageEvent, frame: HTMLIFrameElement | null): boolean {
  if (!frame) return false;
  if (e.source && e.source === frame.contentWindow) return true;
  try {
    const site = new URL(frame.src).hostname.replace(/^(www|player)\./, '');
    const from = new URL(e.origin).hostname;
    return from === site || from.endsWith(`.${site}`);
  } catch {
    return false;
  }
}
