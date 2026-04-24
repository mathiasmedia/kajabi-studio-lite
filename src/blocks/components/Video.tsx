/**
 * <Video> block — Kajabi `video` type.
 *
 * Different from <VideoEmbed> (YouTube/Vimeo URL).
 * This block references a video uploaded to the Kajabi library by ID.
 *
 * Real Kajabi schema (block_video.liquid):
 *   video, poster (image), auto_play, controls_on_load, loop, muted
 *
 * Universal chrome flows in via ChromeProps and wraps the player frame.
 */
import type { BlockComponent } from '../types';
import { withBlockDefaults } from '../blockDefaults';
import { getBlockChromeStyle, serializeChromeProps, type ChromeProps } from '../blockChrome';

export interface VideoProps extends ChromeProps {
  /** Wistia/Kajabi video ID. Leave blank if user will pick in editor. */
  videoId?: string;
  /** Poster image URL shown before play */
  poster?: string;
  autoPlay?: boolean;
  showControls?: boolean;
  loop?: boolean;
  muted?: boolean;
  width?: string;
}

export const Video: BlockComponent<VideoProps> = (props) => {
  const poster = props.poster || 'https://placehold.co/1280x720/0f172a/64748b?text=Kajabi+Video';
  const chrome = getBlockChromeStyle(props);
  return (
    <div style={chrome}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: 8, background: '#000' }}>
        <img src={poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              width: 0, height: 0,
              borderTop: '14px solid transparent',
              borderBottom: '14px solid transparent',
              borderLeft: '22px solid #0f172a',
              marginLeft: 6,
            }} />
          </div>
        </div>
        {!props.videoId && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            padding: '4px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace',
          }}>
            No video selected — pick one in Kajabi editor
          </div>
        )}
      </div>
    </div>
  );
};

Video.kajabiType = 'video';
Video.allowedIn = ['content'];
Video.serialize = (p) => {
  const base = withBlockDefaults({
    width: p.width ?? '10',
    text_align: 'center',
    ...serializeChromeProps(p),
    video: p.videoId ?? '',
    image: p.poster ?? '',
    auto_play: p.autoPlay ? 'true' : 'false',
    controls_on_load: p.showControls === false ? 'false' : 'true',
    play_button: 'true',
    small_play_button: 'true',
    full_screen: 'false',
    playbar: 'false',
    video_settings: 'false',
    loop: p.loop ? 'true' : 'false',
  });
  delete (base as Record<string, unknown>).text_align;
  return base;
};
