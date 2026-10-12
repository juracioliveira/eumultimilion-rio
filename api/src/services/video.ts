import crypto from 'node:crypto';
import { env } from '../env.js';

export type PlaybackSource =
  | { kind: 'hls'; url: string }
  | { kind: 'mp4'; url: string }
  | { kind: 'embed'; url: string }
  | { kind: 'none' };

type LessonVideo = { videoUrl: string | null; bunnyVideoId: string | null; bunnyLibraryId: string | null; status: string };

function youtubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0` : null;
}

function vimeoEmbed(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : null;
}

/** Resolve como o player deve tocar a aula. Só é chamado depois da checagem de acesso. */
export function playbackSource(lesson: LessonVideo): PlaybackSource {
  if (lesson.bunnyVideoId && lesson.status === 'ready') {
    const libraryId = lesson.bunnyLibraryId || env.bunny.libraryId;
    if (env.bunny.embedTokenKey) {
      // Player embed da Bunny com Token Authentication (link expira em 2h)
      const expires = Math.floor(Date.now() / 1000) + 2 * 3600;
      const token = crypto
        .createHash('sha256')
        .update(env.bunny.embedTokenKey + lesson.bunnyVideoId + expires)
        .digest('hex');
      return { kind: 'embed', url: `https://iframe.mediadelivery.net/embed/${libraryId}/${lesson.bunnyVideoId}?token=${token}&expires=${expires}` };
    }
    const host = env.bunny.cdnHostname || `vz-${libraryId}.b-cdn.net`;
    return { kind: 'hls', url: `https://${host}/${lesson.bunnyVideoId}/playlist.m3u8` };
  }
  if (lesson.videoUrl) {
    const url = lesson.videoUrl.trim();
    const embed = youtubeEmbed(url) ?? vimeoEmbed(url);
    if (embed) return { kind: 'embed', url: embed };
    if (/\.m3u8(\?|$)/i.test(url)) return { kind: 'hls', url };
    return { kind: 'mp4', url };
  }
  return { kind: 'none' };
}

export function bunnyConfigured(): boolean {
  return Boolean(env.bunny.apiKey && env.bunny.libraryId);
}

/** Cria o objeto de vídeo na Bunny e devolve credenciais de upload TUS (browser → Bunny). */
export async function createBunnyUpload(title: string) {
  const res = await fetch(`https://video.bunnycdn.com/library/${env.bunny.libraryId}/videos`, {
    method: 'POST',
    headers: { AccessKey: env.bunny.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Bunny respondeu ${res.status}`);
  const video = (await res.json()) as { guid: string };
  const expire = Math.floor(Date.now() / 1000) + 6 * 3600;
  const signature = crypto
    .createHash('sha256')
    .update(env.bunny.libraryId + env.bunny.apiKey + expire + video.guid)
    .digest('hex');
  return {
    videoId: video.guid,
    libraryId: env.bunny.libraryId,
    tus: {
      endpoint: 'https://video.bunnycdn.com/tusupload',
      headers: {
        AuthorizationSignature: signature,
        AuthorizationExpire: String(expire),
        VideoId: video.guid,
        LibraryId: env.bunny.libraryId,
      },
    },
  };
}

/** Busca duração e thumbnail de um vídeo na Bunny (usado quando o webhook avisa que terminou). */
export async function fetchBunnyVideoInfo(libraryId: string, videoId: string) {
  if (!env.bunny.apiKey) return null;
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
    headers: { AccessKey: env.bunny.apiKey, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const v = (await res.json()) as { length?: number; thumbnailFileName?: string };
  const host = env.bunny.cdnHostname || `vz-${libraryId}.b-cdn.net`;
  return {
    durationSeconds: v.length ? Math.round(v.length) : null,
    thumbnailUrl: v.thumbnailFileName ? `https://${host}/${videoId}/${v.thumbnailFileName}` : null,
  };
}
