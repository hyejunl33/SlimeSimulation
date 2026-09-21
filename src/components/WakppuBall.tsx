'use client';

import { useRef, useCallback, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material';
import { useCursor, Instances, Instance } from '@react-three/drei';
import { waxVertexShader, waxFragmentShader, butterVertexShader, butterFragmentShader } from '../shaders/ballShaders';
import { getSoundForBall } from '../sound/ballSound';
import { useStore } from '../store/useStore';

const BEAD_COUNT = 150;

export default function WakppuBall({ overrideLevel }: { overrideLevel?: number }) {
  const storeLevel = useStore((state) => state.level);
  const level = overrideLevel || storeLevel;
  const meshRef = useRef<THREE.Mesh>(null);
  
  useCursor(true, 'pointer', 'auto');

  const beadsColor = useMemo(() => {
    return Array.from({ length: BEAD_COUNT }).map(() => new THREE.Color().setHSL(Math.random(), 0.8, 0.6));
  }, []);

  // Base Geometry: 찐빵 형태 (Squashed Sphere)
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.2, 32); 
    const pos = geo.attributes.position;
    // 하단을 살짝 평평하게 하고 전체적으로 Y축을 압축하여 바닥에 놓인 슬라임 형태 완성
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      if (y < -0.8) y = -0.8; // flatten bottom
      pos.setXYZ(i, pos.getX(i), y * 0.85, pos.getZ(i));
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPressure: { value: 0 },
    uStretch: { value: 0 },
  }), []);

  // Level 2 Scale Stretching
  const targetScale = useRef(new THREE.Vector3(1, 1, 1));
  const isDragging = useRef(false);

  // Level 3 Beads Physics Data
  const beadsData = useMemo(() => {
    const data = [];
    for(let i=0; i < BEAD_COUNT; i++) {
      // Random point inside the sphere
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 0.9; 
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      data.push({ pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(0,0,0) });
    }
    return data;
  }, []);

  const gravity = useRef(new THREE.Vector3(0, -9.8, 0));
  const instanceMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (level !== 3) return;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta || 0; // -180 to 180 (x axis tilt)
      const gamma = e.gamma || 0; // -90 to 90 (y axis tilt)
      gravity.current.set(gamma / 90 * 9.8, -beta / 90 * 9.8, 0);
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [level]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
    
    // Decay pressure (Wax Crack Recovery)
    if (!isDragging.current) {
      uniforms.uPressure.value *= 0.92;
      uniforms.uStretch.value *= 0.92;
      targetScale.current.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    }
    
    if (meshRef.current) {
      meshRef.current.scale.lerp(targetScale.current, 0.2);
    }

    // Level 3 Beads Inside Physics
    if (level === 3 && instanceMeshRef.current) {
      beadsData.forEach((bead, i) => {
        bead.vel.add(gravity.current.clone().multiplyScalar(0.002)); 
        // Add some jitter for realism
        bead.vel.x += (Math.random() - 0.5) * 0.01;
        bead.vel.y += (Math.random() - 0.5) * 0.01;
        bead.pos.add(bead.vel);
        
        // Spherical Boundary Collision
        if (bead.pos.length() > 1.0) {
          bead.pos.normalize().multiplyScalar(1.0);
          bead.vel.reflect(bead.pos.clone().normalize()).multiplyScalar(0.4);
        }
        
        dummy.position.copy(bead.pos);
        dummy.updateMatrix();
        instanceMeshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      instanceMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    isDragging.current = true;
    
    uniforms.uPressure.value = Math.min(uniforms.uPressure.value + 0.5, 1.0);
    
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (level === 1) navigator.vibrate(50);
      else if (level === 2) navigator.vibrate([80, 30, 80]);
      else navigator.vibrate([15, 10, 15, 10, 15]);
    }
    
    const sound = getSoundForBall(level);
    if (level === 2) (sound as any).playPress(uniforms.uPressure.value);
    else if (level === 1) (sound as any).playTap();
    else (sound as any).playCrunch(5);
  }, [level, uniforms]);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging.current) return;
    
    // Stretch based on pointer movement (Safe Scale Lerp, no mesh tearing)
    if (level === 2) {
      uniforms.uStretch.value = Math.min(uniforms.uStretch.value + 0.1, 1.0);
      const stretchX = 1.0 + Math.abs(e.movementX) * 0.05;
      const stretchY = 1.0 + Math.abs(e.movementY) * 0.05;
      
      // Volume preservation (squash other axes)
      targetScale.current.set(
        Math.min(stretchX, 1.8), 
        Math.min(stretchY, 1.8), 
        1.0 - (stretchX * 0.1) // Z squashes slightly
      );
    } else if (level === 1) {
      uniforms.uPressure.value = Math.min(uniforms.uPressure.value + 0.1, 1.5);
    }
  }, [level, uniforms]);

  const handlePointerUp = useCallback((e: any) => {
    e.stopPropagation();
    e.target.releasePointerCapture(e.pointerId);
    isDragging.current = false;
    
    const sound = getSoundForBall(level);
    if (sound.playRelease) sound.playRelease();
  }, [level]);

  const vShader = level === 1 ? waxVertexShader : butterVertexShader;
  const fShader = level === 1 ? waxFragmentShader : butterFragmentShader;

  return (
    <group>
      {/* Base Slime Mesh */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <CustomShaderMaterial
          baseMaterial={THREE.MeshPhysicalMaterial}
          side={THREE.DoubleSide}
          vertexShader={vShader}
          fragmentShader={fShader}
          uniforms={uniforms}
          clearcoat={level === 1 ? 1.0 : (level === 3 ? 1.0 : 0.0)}
          roughness={level === 1 ? 0.1 : (level === 3 ? 0.0 : 0.4)}
          metalness={level === 1 ? 0.2 : 0.0}
          transmission={level === 3 ? 0.98 : 0.0}
          ior={level === 3 ? 1.3 : 1.0}
          thickness={level === 3 ? 1.5 : 0.0}
          transparent={level === 3}
          opacity={level === 3 ? 0.8 : 1.0}
          color={level === 3 ? "#ffffff" : undefined}
        />
      </mesh>
      
      {/* Crunch Beads (Inside Level 3 Transparent Shell) */}
      {level === 3 && (
        <Instances ref={instanceMeshRef} limit={BEAD_COUNT}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshPhysicalMaterial roughness={0.1} clearcoat={1.0} />
          {beadsColor.map((color, i) => (
            <Instance key={i} color={color} />
          ))}
        </Instances>
      )}
    </group>
  );
}
