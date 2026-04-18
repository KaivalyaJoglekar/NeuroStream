'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function MeshDistortion() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // A subtle, slow shifting geometry
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const time = clock.getElapsedTime() * 0.15;
    
    // Very gentle rotation and drift
    meshRef.current.rotation.x = time * 0.3;
    meshRef.current.rotation.y = time * 0.4;
    meshRef.current.position.y = Math.sin(time) * 0.3;
    meshRef.current.position.x = Math.cos(time * 0.8) * 0.2;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -4]} scale={5}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color="#3D369E"
        emissive="#0A0A0E"
        roughness={0.8}
        metalness={0.2}
        wireframe={true}
        transparent={true}
        opacity={0.06}
      />
    </mesh>
  );
}

function Lights() {
  // Soft, cinematic lighting to suggest volume without overpowering
  return (
    <>
      <ambientLight intensity={0.1} />
      <directionalLight position={[5, 5, 5]} intensity={0.4} color="#7B74FF" />
      <pointLight position={[-5, -5, -2]} intensity={0.2} color="#16153B" />
    </>
  );
}

export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#030305]" aria-hidden>
      {/* Three.js Canvas for volumetric depth */}
      <div className="absolute inset-0 opacity-70">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }} gl={{ antialias: true, alpha: true }}>
          <Lights />
          <MeshDistortion />
        </Canvas>
      </div>

      {/* Very faint noise overlay (3% opacity) */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC44NSIgbnVtT2N0YXZlcz0iMyIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNuKSIgb3BhY2l0eT0iMC4wNCIvPjwvc3ZnPg==')] opacity-[0.03] mix-blend-overlay" />
      
      {/* 2% opacity 64px structural grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* Edge vignettes to frame UI */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(3,3,5,0.85)_100%)]" />
      
      {/* Very soft glowing spots tied to edges */}
      <div className="absolute -left-[20vw] top-[10vh] h-[50vw] w-[50vw] rounded-full bg-[#3D369E] opacity-[0.06] blur-[120px]" />
      <div className="absolute -right-[10vw] bottom-[5vh] h-[40vw] w-[40vw] rounded-full bg-[#16153B] opacity-[0.12] blur-[100px]" />
    </div>
  );
}
