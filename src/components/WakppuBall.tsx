'use client';

import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material';
import { useCursor, Instances, Instance } from '@react-three/drei';
import { waxVertexShader, waxFragmentShader, butterVertexShader, butterFragmentShader } from '../shaders/ballShaders';
import { getSoundForBall } from '../sound/ballSound';
import { useStore } from '../store/useStore';

const BEAD_COUNT = 150;
const RADIUS = 0.9; // inside the glass shell

export default function WakppuBall({ overrideLevel }: { overrideLevel?: number }) {
  const storeLevel = useStore((state) => state.level);
  const level = overrideLevel || storeLevel;
  const meshRef = useRef<THREE.Mesh>(null);
  
  const pointerRef = useRef(new THREE.Vector3());
  const pressureRef = useRef(0);
  const isDownRef = useRef(false);
  
  useCursor(true, 'pointer', 'auto');

  // Device Orientation state
  const gravityRef = useRef(new THREE.Vector3(0, -9.8, 0));
  const hasRequestedPermission = useRef(false);

  useEffect(() => {
    if (level !== 3) return;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        const x = e.gamma / 90;
        const y = -e.beta / 90; 
        gravityRef.current.set(x * 15, y * 15, -2);
      }
    };
    
    // Non-iOS devices just listen directly
    if (typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [level]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector3() },
    uPressure: { value: 0 },
  }), []);

  // Simple physics state for beads
  const beadsData = useMemo(() => {
    return Array.from({ length: BEAD_COUNT }).map(() => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * RADIUS,
        (Math.random() - 0.5) * RADIUS,
        (Math.random() - 0.5) * RADIUS
      ),
      velocity: new THREE.Vector3(0, 0, 0),
      color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5)
    }));
  }, []);

  const instanceMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }, delta) => {
    uniforms.uTime.value = clock.getElapsedTime();
    if (isDownRef.current) {
      pressureRef.current = Math.min(pressureRef.current + 0.05, 1.0);
    } else {
      pressureRef.current *= 0.92;
    }
    uniforms.uPressure.value = pressureRef.current;

    // Physics update for Level 3
    if (level === 3 && instanceMeshRef.current) {
      const dt = Math.min(delta, 0.05); // cap delta time
      const friction = 0.98;

      beadsData.forEach((bead, i) => {
        // Add gravity
        bead.velocity.addScaledVector(gravityRef.current, dt);

        // If pointer is down, add repulsion from pointer
        if (isDownRef.current) {
          const repel = new THREE.Vector3().subVectors(bead.position, pointerRef.current);
          const dist = repel.length();
          if (dist < 0.5) {
            bead.velocity.add(repel.normalize().multiplyScalar(15 * dt * (0.5 - dist)));
          }
        }

        // Apply friction
        bead.velocity.multiplyScalar(friction);

        // Update position
        bead.position.addScaledVector(bead.velocity, dt);

        // Sphere bounds collision (inside the glass shell)
        const distFromCenter = bead.position.length();
        if (distFromCenter > RADIUS) {
          // Push back inside
          const normal = bead.position.clone().normalize();
          bead.position.copy(normal.multiplyScalar(RADIUS));
          // Reflect velocity (bounce)
          bead.velocity.reflect(normal).multiplyScalar(0.5); // damping
        }

        // Apply to instance matrix
        dummy.position.copy(bead.position);
        dummy.updateMatrix();
        instanceMeshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      instanceMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const handlePointerMove = useCallback((e: any) => {
    pointerRef.current.copy(e.point);
    uniforms.uPointer.value.copy(pointerRef.current);
  }, [uniforms]);

  const handlePointerDown = useCallback(() => {
    isDownRef.current = true;
    pressureRef.current += 0.3;
    
    // Request DeviceOrientation permission on first user gesture for iOS
    if (level === 3 && !hasRequestedPermission.current && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      hasRequestedPermission.current = true;
      (DeviceOrientationEvent as any).requestPermission()
        .then((response: string) => {
          if (response === 'granted') {
            const handleOrientation = (e: DeviceOrientationEvent) => {
              if (e.gamma !== null && e.beta !== null) {
                gravityRef.current.set(e.gamma / 90 * 15, -e.beta / 90 * 15, -2);
              }
            };
            window.addEventListener('deviceorientation', handleOrientation);
          }
        })
        .catch(console.error);
    }
    
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

  if (level === 3) {
    return (
      <group onPointerMove={handlePointerMove} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
        <mesh>
          <icosahedronGeometry args={[1, 32]} />
          <meshPhysicalMaterial transmission={0.95} roughness={0.05} ior={1.4} thickness={0.5} transparent opacity={0.3} color="#ffffff" />
        </mesh>
        <Instances ref={instanceMeshRef} limit={BEAD_COUNT}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial />
          {beadsData.map((bead, i) => (
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
