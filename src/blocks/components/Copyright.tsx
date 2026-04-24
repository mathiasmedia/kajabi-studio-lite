/**
 * <Copyright> block — Kajabi `copyright` type (footer only).
 *
 * Real Kajabi schema (from footer_block_copyright.liquid):
 *   - copyright (string) — that's it.
 *
 * Universal chrome flows in via ChromeProps so copyright can be carded if needed.
 */
import type { BlockComponent } from '../types';
import { getBlockChromeStyle, type ChromeProps } from '../blockChrome';

export interface CopyrightProps extends ChromeProps {
  text: string;
  /** Preview-only alignment */
  align?: 'left' | 'center' | 'right';
}

export const Copyright: BlockComponent<CopyrightProps> = (props) => {
  const chrome = getBlockChromeStyle(props);
  return (
    <div
      style={{
        textAlign: props.align ?? 'center',
        padding: '12px 0',
        fontSize: 13,
        opacity: 0.75,
        ...chrome,
      }}
    >
      {props.text}
    </div>
  );
};

Copyright.kajabiType = 'copyright';
Copyright.allowedIn = ['footer'];
Copyright.serialize = (p) => ({
  copyright: p.text ?? '',
});
