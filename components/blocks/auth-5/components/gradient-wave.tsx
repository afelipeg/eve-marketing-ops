const STYLES = `
  .auth18-wave { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .auth18-blob { position: absolute; border-radius: 9999px; filter: blur(110px); will-change: transform; }
  .auth18-blob-1 {
    top: -18%; right: -12%;
    width: 64vw; height: 64vw; max-width: 780px; max-height: 780px;
    background: radial-gradient(circle at 30% 30%, rgba(255, 138, 61, 0.78), rgba(255, 138, 61, 0) 70%);
    animation: auth18-drift-1 22s ease-in-out infinite;
  }
  .auth18-blob-2 {
    top: 6%; right: 18%;
    width: 52vw; height: 52vw; max-width: 640px; max-height: 640px;
    background: radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.6), rgba(236, 72, 153, 0) 70%);
    animation: auth18-drift-2 30s ease-in-out infinite;
  }
  .auth18-blob-3 {
    top: 32%; right: -6%;
    width: 48vw; height: 48vw; max-width: 600px; max-height: 600px;
    background: radial-gradient(circle at 60% 40%, rgba(139, 92, 246, 0.55), rgba(139, 92, 246, 0) 70%);
    animation: auth18-drift-3 26s ease-in-out infinite;
  }
  .auth18-blob-4 {
    top: 58%; right: 12%;
    width: 44vw; height: 44vw; max-width: 560px; max-height: 560px;
    background: radial-gradient(circle at 40% 60%, rgba(59, 130, 246, 0.45), rgba(59, 130, 246, 0) 70%);
    animation: auth18-drift-4 34s ease-in-out infinite;
  }
  .auth18-grain {
    position: absolute; inset: 0; opacity: 0.35; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  }
  .dark .auth18-blob-1 { background: radial-gradient(circle at 30% 30%, rgba(255, 138, 61, 0.55), rgba(255, 138, 61, 0) 70%); }
  .dark .auth18-blob-2 { background: radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.45), rgba(236, 72, 153, 0) 70%); }
  .dark .auth18-blob-3 { background: radial-gradient(circle at 60% 40%, rgba(139, 92, 246, 0.45), rgba(139, 92, 246, 0) 70%); }
  .dark .auth18-blob-4 { background: radial-gradient(circle at 40% 60%, rgba(59, 130, 246, 0.38), rgba(59, 130, 246, 0) 70%); }
  .dark .auth18-grain { opacity: 0.18; }
  @keyframes auth18-drift-1 {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(-5%, 7%, 0) scale(1.08); }
  }
  @keyframes auth18-drift-2 {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(7%, -5%, 0) scale(1.12); }
  }
  @keyframes auth18-drift-3 {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(-7%, -7%, 0) scale(1.1); }
  }
  @keyframes auth18-drift-4 {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(9%, 5%, 0) scale(1.14); }
  }
  @media (prefers-reduced-motion: reduce) {
    .auth18-blob { animation: none !important; }
  }
`

export function GradientWave() {
  return (
    <div aria-hidden="true" className="auth18-wave">
      <div className="auth18-blob auth18-blob-1" />
      <div className="auth18-blob auth18-blob-2" />
      <div className="auth18-blob auth18-blob-3" />
      <div className="auth18-blob auth18-blob-4" />
      <div className="auth18-grain" />
      <style>{STYLES}</style>
    </div>
  )
}