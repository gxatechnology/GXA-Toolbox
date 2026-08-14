export function AdPlacementPlaceholder() {
  return (
    <aside
      className="gxa-tool-ad-placement"
      data-ad-placement="tool-content"
      data-ad-state="awaiting-ad-unit"
      aria-label="Advertisement"
      hidden
    >
      <span className="gxa-tool-ad-label">Advertisement</span>
      <div className="gxa-tool-ad-unit-mount" data-ad-unit-mount />
    </aside>
  );
}
