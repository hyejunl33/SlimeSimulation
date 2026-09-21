'use client';

import { useRef, useCallback, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material';
import { useCursor, Instances, Instance } from '@react-three/drei';
import { waxVertexShader, waxFragmentShader, butterVertexShader, butterFragmentShader } from '../shaders/ballShaders';
import { getSoundForBall } from '../sound/ballSound';
import { useStore } from '../store/useStore';

export default function WakppuBall() {
  const level = useStore((state) => state.level);
  const meshRef = useRef<THREE.Mesh>(null);
  
  const pointerRef = useRef(new THREE.Vector3());
  const pressureRef = useRef(0);
  const isDownRef = useRef(false);
  
  useCursor(true, 'pointer', 'auto');

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector3() },
    uPressure: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
    if (isDownRef.current) {
      pressureRef.current = Math.min(pressureRef.current + 0.05, 1.0);
    } else {
      pressureRef.current *= 0.92;
    }
    uniforms.uPressure.value = pressureRef.current;
  });

  const handlePointerMove = useCallback((e: any) => {
    pointerRef.current.copy(e.point);
    uniforms.uPointer.value.copy(pointerRef.current);
  }, [uniforms]);

  const handlePointerDown = useCallback(() => {
    isDownRef.current = true;
    pressureRef.current += 0.3;
    
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (level === 1) navigator.vibrate(50);
      else if (level === 2) navigator.vibrate([80, 30, 80]);
      else navigator.vibrate([15, 10, 15, 10, 15]);
    }
    
    const sound = getSoundForBall(level);
    if (level === 2) (sound as any).playPress(pressureRef.current);
    else if (level === 1) (sound as any).playTap();
    else (sound as any).playCrunch(5);
  }, [level]);

  const handlePointerUp = useCallback(() => {
    isDownRef.current = false;
    const sound = getSoundForBall(level);
    if (sound.playRelease) sound.playRelease();
  }, [level]);

  const beads = useMemo(() => {
    if (level !== 3) return [];
    return Array.from({ length: 150 }).map(() => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5
      ),
      color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5)
    }));
  }, [level]);

  if (level === 3) {
    return (
      <group onPointerMove={handlePointerMove} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
        <mesh>
          <icosahedronGeometry args={[1, 32]} />
          <meshPhysicalMaterial transmission={0.95} roughness={0.05} ior={1.4} thickness={0.5} transparent opacity={0.3} color="#ffffff" />
        </mesh>
        <Instances limit={150}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial />
          {beads.map((bead, i) => (
            <Instance key={i} position={bead.position} color={bead.color} />
          ))}
        </Instances>
      </group>
    );
  }

  const vShader = level === 1 ? waxVertexShader : butterVertexShader;
  const fShader = level === 1 ? waxFragmentShader : butterFragmentShader;

  return (
    <mesh
      ref={meshRef}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <icosahedronGeometry args={[1, 64]} />
      <CustomShaderMaterial
        baseMaterial={THREE.MeshPhysicalMaterial}
        vertexShader={vShader}
        fragmentShader={fShader}
        uniforms={uniforms}
        clearcoat={level === 1 ? 1.0 : 0.0}
        roughness={level === 1 ? 0.0 : 0.6}
        metalness={0.1}
      />
    </mesh>
  );
}
