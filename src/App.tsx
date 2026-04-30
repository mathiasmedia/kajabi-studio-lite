import { memo } from "react";

// Mount the iframe exactly once. React reuses this same element across every
// re-render of <App />, so the iframe never reloads on parent re-renders or
// HMR updates to sibling modules.
const FrameOnce = memo(
  function FrameOnce() {
    return (
      <iframe
        key="kajabi-studio-iframe-v1"
        src="https://kajabi-studio-max.lovable.app"
        title="Kajabi Studio"
        style={{
          border: "none",
          width: "100vw",
          height: "100vh",
          display: "block",
        }}
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    );
  },
  // Always-equal: this component takes no props, so never re-render it.
  () => true,
);

export default function App() {
  return <FrameOnce />;
}

// Force a full page reload (instead of HMR swap) when this module changes,
// so we never end up with a half-swapped iframe in dev. In production this
// is a no-op.
if (import.meta.hot) {
  import.meta.hot.invalidate();
}
