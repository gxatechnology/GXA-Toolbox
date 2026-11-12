export function AdPlacementPlaceholder() {
  return (
    <aside
      className="gxa-tool-ad-placement tool-ad-placement"
      data-ad-placement="tool-content"
      data-ad-zone="ad-slot-after-tool"
      data-ad-trigger="result-ready"
      data-ad-state="awaiting-ad-unit"
      aria-label="Advertisement"
    >
      <span className="gxa-tool-ad-label">Advertisement</span>
      <div className="gxa-tool-ad-unit-mount" data-ad-unit-mount />
    </aside>
  );
}
