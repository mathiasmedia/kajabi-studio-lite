/**
 * <VideoEmbed> block — Kajabi `video_embed` type.
 *
 * Real Kajabi schema (from block_video_embed.liquid): a SINGLE field
 * called `code` containing raw embed HTML (iframe / script tag from
 * YouTube/Vimeo/Wistia/etc).
 *
 * For convenience, this component also accepts a `videoUrl` and auto-converts
 * common YouTube/Vimeo URLs to an iframe, but you can pass `code` directly.
 *
 * Universal chrome flows in via ChromeProps.
 */
import type { BlockComponent } from '../types';
import { withBlockDefaults } from '../blockDefaults';
import { getBlockChromeStyle, serializeChromeProps, type ChromeProps } from '../blockChrome';

export interface VideoEmbedProps extends ChromeProps {
  code?: string;
  videoUrl?: string;
  aspectRatio?: '16:9' | '4:3' | '1:1';
  /** Bootstrap col 1-12. Default 12 (full width). */
  width?: string;
}

function urlToEmbedCode(url: string, ratio: '16:9' | '4:3' | '1:1'): string {
  let embed = url;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
  if (yt) embed = `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) embed = `https://player.vimeo.com/video/${vm[1]}`;
  const [w, h] = ratio.split(':').map(Number);
  const padding = `${(h / w) * 100}%`;
  return `<div style="position:relative;padding-top:${padding}"><iframe src="${embed}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>`;
}

export const VideoEmbed: BlockComponent<VideoEmbedProps> = (props) => {
  const ratio = props.aspectRatio ?? '16:9';
  const html = props.code ?? (props.videoUrl ? urlToEmbedCode(props.videoUrl, ratio) : '');
  const chrome = getBlockChromeStyle(props);
  return (
    <div style={{ padding: '12px 0', ...chrome }} dangerouslySetInnerHTML={{ __html: html }} />
  );
};

VideoEmbed.kajabiType = 'video_embed';
VideoEmbed.allowedIn = ['content'];
VideoEmbed.serialize = (p) => withBlockDefaults({
  width: p.width ?? '12',
  ...serializeChromeProps(p),
  code: p.code ?? (p.videoUrl ? urlToEmbedCode(p.videoUrl, p.aspectRatio ?? '16:9') : ''),
});
