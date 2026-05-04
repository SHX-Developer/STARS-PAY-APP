import { TOKENS } from '../lib/tokens';

export function AppBackground() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: TOKENS.bg0,
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -120,
          left: -80,
          width: 380,
          height: 380,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(155,123,255,0.55) 0%, rgba(155,123,255,0) 65%)',
          filter: 'blur(20px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 200,
          right: -100,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(123,92,230,0.45) 0%, rgba(123,92,230,0) 65%)',
          filter: 'blur(25px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: '20%',
          width: 280,
          height: 280,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(242,198,107,0.18) 0%, rgba(242,198,107,0) 65%)',
          filter: 'blur(30px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.4,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '3px 3px',
        }}
      />
    </div>
  );
}
