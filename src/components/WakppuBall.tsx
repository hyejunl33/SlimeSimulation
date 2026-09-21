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

  // Multi-touch tracking
  const activePointers = useRef(new Map<number, THREE.Vector3>());
  
  const beadsColor = useMemo(() => {
    return Array.from({ length: BEAD_COUNT }).map(() => new THREE.Color().setHSL(Math.random(), 0.8, 0.6));
  }, []);

  // CPU Sculpting Geometry & Topology (Adjacency List for Smoothing)
  const { geometry, beadIndices, adjacencyList } = useMemo(() => {
    // 32 segments is approx 10,000 vertices: perfectly fast for mobile JS, yet very smooth
    const geo = new THREE.IcosahedronGeometry(1.2, 32); 
    const pos = geo.attributes.position;
    
    // Apply organic noise for lumpy clay look (not a perfect sphere)
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      const bump = Math.sin(v.x * 3.1) * Math.cos(v.y * 2.8) * 0.12 + Math.sin(v.z * 4.0) * 0.08;
      v.add(v.clone().normalize().multiplyScalar(bump));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();

    // 1. Build Adjacency List for Laplacian Smoothing (True surface tension)
    const adj: Set<number>[] = Array.from({ length: pos.count }, () => new Set<number>());
    const idx = geo.index;
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i);
        const b = idx.getX(i + 1);
        const c = idx.getX(i + 2);
        adj[a].add(b); adj[a].add(c);
        adj[b].add(a); adj[b].add(c);
        adj[c].add(a); adj[c].add(b);
      }
    }
    const adjacencyListArray = adj.map(set => Array.from(set));

    // 2. Attach beads randomly to vertices
    const indices = [];
    for(let i=0; i < BEAD_COUNT; i++) {
      indices.push(Math.floor(Math.random() * pos.count));
    }

    return { geometry: geo, beadIndices: indices, adjacencyList: adjacencyListArray };
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
      
      beadIndices.forEach((vIdx, i) => {
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

    // CPU Plastic Sculpting & Volume Preservation with Laplacian Smoothing
    const positions = geometry.attributes.position;
    const arr = positions.array as Float32Array;
    
    let modified = false;
    const modifiedIndices = new Set<number>();
    
    const deltaLen = delta.length();
    const deltaNorm = delta.clone().normalize();

    for (let i = 0; i < positions.count; i++) {
      const v = new THREE.Vector3(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
      const distToPointer = v.distanceTo(currPoint);
      
      if (level === 1) { // Wax: Digs in (Crater)
        if (distToPointer < 0.5) {
          const pushAmt = Math.exp(-(distToPointer * distToPointer) / 0.1);
          const push = v.clone().normalize().multiplyScalar(-0.15 * pushAmt);
          v.add(push);
          arr[i*3] = v.x; arr[i*3+1] = v.y; arr[i*3+2] = v.z;
          modified = true;
          modifiedIndices.add(i);
        }
      } else { 
        // Level 2 & 3: Stretches and Squashes
        if (distToPointer < 0.8) {
          // Pull vertices towards finger safely
          const pullAmt = Math.exp(-(distToPointer * distToPointer) / 0.2);
          const pull = delta.clone().multiplyScalar(1.5 * pullAmt);
          v.add(pull);
          
          // Squash sides inward to preserve volume safely
          const toV = v.clone().sub(currPoint);
          const projLength = toV.dot(deltaNorm);
          const perp = toV.clone().sub(deltaNorm.clone().multiplyScalar(projLength));
          const perpDist = perp.length();
          
          if (Math.abs(projLength) < 0.6 && perpDist > 0.05) {
             const squeezeAmt = Math.exp(-(perpDist * perpDist) / 0.2);
             const squeeze = perp.clone().normalize().multiplyScalar(-deltaLen * 0.7 * squeezeAmt);
             v.add(squeeze);
          }
          
          arr[i*3] = v.x; arr[i*3+1] = v.y; arr[i*3+2] = v.z;
          modified = true;
          modifiedIndices.add(i);
        }
      }
    }
    
    if (modified) {
      // 🌟 LAPLACIAN SMOOTHING (Surface Tension / Cohesion)
      // This mathematically prevents mesh tearing, self-intersection, and sharp spikes.
      const newPos = new Float32Array(arr.length);
      newPos.set(arr);

      for (let pass = 0; pass < 2; pass++) {
        for (const idx of modifiedIndices) {
          const neighbors = adjacencyList[idx];
          if (!neighbors || neighbors.length === 0) continue;
          
          let sumX = 0, sumY = 0, sumZ = 0;
          for (const n of neighbors) {
            sumX += arr[n * 3];
            sumY += arr[n * 3 + 1];
            sumZ += arr[n * 3 + 2];
          }
          const avgX = sumX / neighbors.length;
          const avgY = sumY / neighbors.length;
          const avgZ = sumZ / neighbors.length;
          
          // Relax towards neighbors
          const factor = level === 1 ? 0.3 : 0.65; // Butter is highly cohesive (gooey)
          newPos[idx * 3] = arr[idx * 3] * (1 - factor) + avgX * factor;
          newPos[idx * 3 + 1] = arr[idx * 3 + 1] * (1 - factor) + avgY * factor;
          newPos[idx * 3 + 2] = arr[idx * 3 + 2] * (1 - factor) + avgZ * factor;
        }
        // Write back for next pass / final result
        for (const idx of modifiedIndices) {
          arr[idx * 3] = newPos[idx * 3];
          arr[idx * 3 + 1] = newPos[idx * 3 + 1];
          arr[idx * 3 + 2] = newPos[idx * 3 + 2];
        }
      }

      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    }
    
    activePointers.current.set(e.pointerId, currPoint.clone());
  }, [level, geometry, adjacencyList]);

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
