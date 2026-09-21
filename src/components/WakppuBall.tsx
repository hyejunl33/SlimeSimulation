'use client';

import { useRef, useCallback, useMemo } from 'react';
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

  // Multi-touch tracking
  const activePointers = useRef(new Map<number, THREE.Vector3>());
  
  // Real Crunch Slime: Beads attached to surface
  const beadIndices = useRef<number[]>([]);
  const beadsColor = useMemo(() => {
    return Array.from({ length: BEAD_COUNT }).map(() => new THREE.Color().setHSL(Math.random(), 0.8, 0.6));
  }, []);

  // CPU Sculpting Geometry (Organic Clay Base)
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.2, 48); // High res for smooth clay
    const pos = geo.attributes.position;
    
    // Apply organic noise for lumpy clay look (not a perfect sphere)
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      // Low frequency sine waves to create organic lumps
      const bump = Math.sin(v.x * 3.1) * Math.cos(v.y * 2.8) * 0.12 + Math.sin(v.z * 4.0) * 0.08;
      v.add(v.clone().normalize().multiplyScalar(bump));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();

    // Attach beads randomly to vertices
    const indices = [];
    for(let i=0; i < BEAD_COUNT; i++) {
      indices.push(Math.floor(Math.random() * pos.count));
    }
    beadIndices.current = indices;

    return geo;
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPressure: { value: 0 },
  }), []);

  const instanceMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
    
    // Decay pressure over time if no active touches
    if (activePointers.current.size === 0) {
      uniforms.uPressure.value *= 0.92;
    }

    // Sync Beads with deformed clay surface (Real Crunch Slime)
    if (level === 3 && instanceMeshRef.current) {
      const pos = geometry.attributes.position;
      const norm = geometry.attributes.normal;
      
      beadIndices.current.forEach((vIdx, i) => {
        const v = new THREE.Vector3(pos.getX(vIdx), pos.getY(vIdx), pos.getZ(vIdx));
        const n = new THREE.Vector3(norm.getX(vIdx), norm.getY(vIdx), norm.getZ(vIdx));
        
        // Push beads slightly out so they stick out of the slime surface
        v.add(n.multiplyScalar(0.04));
        
        dummy.position.copy(v);
        // Align bead with surface normal
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        dummy.updateMatrix();
        instanceMeshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      instanceMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const handlePointerDown = useCallback((e: any) => {
    e.target.setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, e.point.clone());
    uniforms.uPressure.value = Math.min(uniforms.uPressure.value + 0.3, 1.0);
    
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
    if (!activePointers.current.has(e.pointerId)) return;
    
    const prevPoint = activePointers.current.get(e.pointerId)!;
    const currPoint = e.point;
    const delta = new THREE.Vector3().subVectors(currPoint, prevPoint);
    
    if (delta.lengthSq() < 0.0001) return;

    // CPU Plastic Sculpting & Volume Preservation
    const positions = geometry.attributes.position;
    let modified = false;
    
    const deltaLen = delta.length();
    const deltaNorm = delta.clone().normalize();

    for (let i = 0; i < positions.count; i++) {
      const v = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const distToPointer = v.distanceTo(currPoint);
      
      if (level === 1) { // Wax: Digs in (Crater)
        if (distToPointer < 0.5) {
          const pushAmt = Math.exp(-(distToPointer * distToPointer) / 0.1);
          const push = v.clone().normalize().multiplyScalar(-0.15 * pushAmt);
          v.add(push);
          positions.setXYZ(i, v.x, v.y, v.z);
          modified = true;
        }
      } else { 
        // Level 2 & 3: Stretches and Squashes (Smooth Gaussian Falloff prevents tearing)
        if (distToPointer < 0.8) {
          // Pull vertices towards finger safely
          const pullAmt = Math.exp(-(distToPointer * distToPointer) / 0.2);
          const pull = delta.clone().multiplyScalar(1.8 * pullAmt);
          v.add(pull);
          
          // Squash sides inward to preserve volume safely
          const toV = v.clone().sub(currPoint);
          const projLength = toV.dot(deltaNorm);
          const perp = toV.clone().sub(deltaNorm.clone().multiplyScalar(projLength));
          const perpDist = perp.length();
          
          if (Math.abs(projLength) < 0.6 && perpDist > 0.05) {
             const squeezeAmt = Math.exp(-(perpDist * perpDist) / 0.2);
             const squeeze = perp.clone().normalize().multiplyScalar(-deltaLen * 0.9 * squeezeAmt);
             v.add(squeeze);
          }
          
          positions.setXYZ(i, v.x, v.y, v.z);
          modified = true;
        }
      }
    }
    
    if (modified) {
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    }
    
    activePointers.current.set(e.pointerId, currPoint.clone());
  }, [level, geometry]);

  const handlePointerUp = useCallback((e: any) => {
    e.target.releasePointerCapture(e.pointerId);
    activePointers.current.delete(e.pointerId);
    
    const sound = getSoundForBall(level);
    if (sound.playRelease) sound.playRelease();
  }, [level]);

  const vShader = level === 1 ? waxVertexShader : butterVertexShader;
  const fShader = level === 1 ? waxFragmentShader : butterFragmentShader;

  return (
    <group>
      {/* Base Clay Mesh */}
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
          roughness={level === 1 ? 0.2 : (level === 3 ? 0.0 : 0.6)}
          metalness={0.1}
          transmission={level === 3 ? 0.95 : 0.0}
          ior={level === 3 ? 1.4 : 1.0}
          thickness={level === 3 ? 0.5 : 0.0}
          transparent={level === 3}
          opacity={level === 3 ? 0.6 : 1.0}
          color={level === 3 ? "#ffffff" : undefined}
        />
      </mesh>
      
      {/* Crunch Beads (Only for Level 3) */}
      {level === 3 && (
        <Instances ref={instanceMeshRef} limit={BEAD_COUNT}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshPhysicalMaterial roughness={0.1} clearcoat={1.0} transmission={0.2} />
          {beadsColor.map((color, i) => (
            <Instance key={i} color={color} />
          ))}
        </Instances>
      )}
    </group>
  );
}
