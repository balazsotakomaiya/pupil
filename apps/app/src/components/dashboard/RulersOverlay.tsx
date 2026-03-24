export function RulersOverlay() {
  return (
    <div aria-hidden="true" className="rulers">
      <div className="ruler-v left" />
      <div className="ruler-v right" />
      <div className="ruler-v content-left" />
      <div className="ruler-v content-right" />
      <div className="ruler-h top" />
      <div className="ruler-h bottom" />
    </div>
  );
}
