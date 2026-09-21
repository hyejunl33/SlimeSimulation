'use client';

import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import WakppuBall from './WakppuBall';

export default function Scene() {
  return (
    <div className="absolute inset-0 z-0 bg-[#f9fafb]">
      <Canvas camera={{ position: [0, 0, 4.5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Environment preset="city" />
        <group position={[-1.8, 0, 0]} scale={0.7}>
          <WakppuBall overrideLevel={1} />
        </group>
        <group position={[0, 0, 0]} scale={0.7}>
          <WakppuBall overrideLevel={2} />
        </group>
        <group position={[1.8, 0, 0]} scale={0.7}>
          <WakppuBall overrideLevel={3} />
        </group>
        <ContactShadows position={[0, -1.2, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
      </Canvas>
    </div>
  );
}
