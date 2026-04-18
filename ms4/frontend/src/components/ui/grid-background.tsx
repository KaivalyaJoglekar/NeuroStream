'use client';

export function GridBackground() {
  return (
    <div className="fixed inset-0 z-[-1] bg-black overflow-hidden pointer-events-none perspective-1000">
      {/* Deep fading glow at the very center horizon */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[30vh] bg-brand/5 blur-[120px] rounded-full pointer-events-none" />

      {/* The 3D Grid Plane */}
      <div 
        className="absolute w-[200vw] h-[200vh] -left-[50vw] top-[30vh] transform-gpu"
        style={{
          transform: 'rotateX(75deg)',
          transformOrigin: 'top center',
          backgroundSize: '80px 80px',
          backgroundImage: `
            linear-gradient(to right, rgba(20, 184, 166, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(20, 184, 166, 0.05) 1px, transparent 1px)
          `,
          maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 40%, transparent 80%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 40%, transparent 80%)',
        }}
      >
        <div className="absolute inset-0 animate-grid-flow"
             style={{
               backgroundSize: '80px 80px',
               backgroundImage: `
                 linear-gradient(to right, rgba(20, 184, 166, 0.1) 1px, transparent 1px),
                 linear-gradient(to bottom, rgba(20, 184, 166, 0.1) 1px, transparent 1px)
               `,
             }}
        />
      </div>

      <style jsx>{`
        @keyframes grid-flow {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(80px);
          }
        }
        .animate-grid-flow {
          animation: grid-flow 3s linear infinite;
        }
        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </div>
  );
}
