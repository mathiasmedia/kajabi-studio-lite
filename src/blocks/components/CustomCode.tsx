/**
 * <CustomCode> block — Kajabi `code` type.
 *
 * Raw HTML/JS escape hatch. Maps to CODE_BLOCK_FIELDS.
 *
 * Universal chrome wraps the injected HTML so custom embeds can be carded.
 */
import type { BlockComponent } from '../types';
import { withBlockDefaults } from '../blockDefaults';
import { getBlockChromeStyle, serializeChromeProps, type ChromeProps } from '../blockChrome';

export interface CustomCodeProps extends ChromeProps {
  code: string;
  /** Bootstrap col 1-12. Default 12 (full width). */
  width?: string;
}

export const CustomCode: BlockComponent<CustomCodeProps> = (props) => {
  const chrome = getBlockChromeStyle(props);
  if (chrome) {
    return <div style={chrome} dangerouslySetInnerHTML={{ __html: props.code }} />;
  }
  return <div dangerouslySetInnerHTML={{ __html: props.code }} />;
};

CustomCode.kajabiType = 'code';
CustomCode.allowedIn = ['content'];
CustomCode.serialize = (p) => withBlockDefaults({
  width: p.width ?? '12',
  ...serializeChromeProps(p),
  code: p.code ?? '',
});
