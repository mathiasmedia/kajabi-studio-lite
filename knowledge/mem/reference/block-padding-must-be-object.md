---
name: Block padding prop MUST be an object, never a scalar string
description: A `padding: "32"` prop on a block is silently ignored — must be `{top,right,bottom,left}`
type: constraint
---

`getBlockChromeStyle` (in `src/blocks/blockChrome.ts`) only honors `props.padding` when it's a `PaddingObject` (or a JSON-serialized object string). A bare scalar like `padding: "32"` or `padding: 32` is passed to `JSON.parse` which returns the number `32`, fails the object check, and the helper returns no padding CSS at all.

Symptoms:
- Testimonial / feature cards render with text hugging all four edges of their colored panel
- "Looks like padding works in the editor field but not in the preview"

Always write block padding as:
```ts
{ padding: { top: "32", right: "32", bottom: "32", left: "32" } }
```

Same rule for ALL blocks (text, feature, image, etc.) — `padding` is universal chrome.

When auditing a site for spacing bugs, run a normalizer pass over `design.pages.*.sections[*].blocks[*].props.padding`: if it's a string/number, expand to a 4-sided object.

Side note for `feature` blocks rendering a button: the `Feature` component renders the button as a SIBLING of the text HTML inside the chrome `<div>`. If you've already wrapped your heading+body in a `<div style="padding:28px">`, the button still sits outside that wrapper and against the card edge. Either (a) set real chrome padding via the object form (preferred), OR (b) inline the button as an `<a>` inside the same wrapper div and set `showButton: false`.
