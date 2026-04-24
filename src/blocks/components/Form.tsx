/**
 * <Form> block — Kajabi `form` type.
 *
 * Renders a placeholder for an opt-in form. The actual form is selected by
 * the user inside the Kajabi editor.
 *
 * Real Kajabi schema (block_form.liquid):
 *   form, heading-via-text, btn_background_color, btn_text_color, width
 *
 * Universal chrome flows in via ChromeProps and overrides the dashed
 * placeholder styling when the planner sets background_color/padding/etc.
 */
import type { BlockComponent } from '../types';
import { withBlockDefaults } from '../blockDefaults';
import { getBlockChromeStyle, serializeChromeProps, type ChromeProps } from '../blockChrome';

export interface FormProps extends ChromeProps {
  /** Kajabi opt-in form ID. Leave blank — user assigns in editor. */
  formId?: string;
  heading?: string;
  /** HTML intro text */
  text?: string;
  buttonBackgroundColor?: string;
  buttonTextColor?: string;
  width?: string;
}

export const Form: BlockComponent<FormProps> = (props) => {
  const chrome = getBlockChromeStyle(props);
  // Built-in placeholder styling (dashed border + slate bg) only applies when
  // the planner hasn't supplied chrome — otherwise the chrome wins.
  const baseStyle = chrome ?? {
    border: '2px dashed #cbd5e1',
    borderRadius: 8,
    padding: 32,
    background: '#f8fafc',
  };
  return (
    <div style={{ textAlign: 'center', ...baseStyle }}>
      {props.heading && (
        <h3 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 700 }}>{props.heading}</h3>
      )}
      {props.text && (
        <div
          style={{ marginBottom: 16, color: '#475569' }}
          dangerouslySetInnerHTML={{ __html: props.text }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, margin: '0 auto' }}>
        <input
          type="email"
          placeholder="you@example.com"
          disabled
          style={{ padding: '10px 12px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 14 }}
        />
        <button
          type="button"
          disabled
          style={{
            padding: '10px 16px',
            backgroundColor: props.buttonBackgroundColor ?? '#3B82F6',
            color: props.buttonTextColor ?? '#ffffff',
            border: 'none',
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'not-allowed',
          }}
        >
          Subscribe
        </button>
      </div>
      <div style={{
        marginTop: 16, fontSize: 11, fontFamily: 'monospace', color: '#94a3b8',
      }}>
        {props.formId
          ? `Form ID: ${props.formId}`
          : 'Assign a form in the Kajabi editor after import'}
      </div>
    </div>
  );
};

Form.kajabiType = 'form';
Form.allowedIn = ['content'];
Form.serialize = (p) => {
  const headingHtml = p.heading ? `<h3>${p.heading}</h3>` : '';
  const text = headingHtml + (p.text ?? '');
  return withBlockDefaults({
    width: p.width ?? '6',
    text_align: 'center',
    ...serializeChromeProps(p),
    form: p.formId ?? '',
    text,
    btn_text: 'Submit',
    btn_width: 'auto',
    btn_style: 'solid',
    btn_size: 'medium',
    btn_border_radius: '',
    btn_text_color: p.buttonTextColor ?? '',
    btn_background_color: p.buttonBackgroundColor ?? '',
    input_label: 'placeholder',
    inline: 'false',
  });
};
