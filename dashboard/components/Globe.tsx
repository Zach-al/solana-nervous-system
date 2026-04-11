'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Real-world city coordinates [lat, lon]
const NODES = [
  { name: 'Mumbai', lat: 19.076, lon: 72.877 },
  { name: 'Tokyo', lat: 35.676, lon: 139.650 },
  { name: 'New York', lat: 40.713, lon: -74.006 },
  { name: 'London', lat: 51.507, lon: -0.128 },
  { name: 'Singapore', lat: 1.352, lon: 103.820 },
  { name: 'Frankfurt', lat: 50.110, lon: 8.682 },
  { name: 'São Paulo', lat: -23.550, lon: -46.633 },
  { name: 'Sydney', lat: -33.869, lon: 151.209 },
  { name: 'Toronto', lat: 43.651, lon: -79.347 },
  { name: 'Dubai', lat: 25.204, lon: 55.270 },
  { name: 'Seoul', lat: 37.566, lon: 126.978 },
  { name: 'Lagos', lat: 6.524, lon: 3.379 },
];

const GLOBE_RADIUS = 1.0;

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function GlobeSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <meshPhongMaterial
        color={new THREE.Color(0x080820)}
        emissive={new THREE.Color(0x0a0035)}
        emissiveIntensity={0.3}
        transparent
        opacity={0.95}
        wireframe={false}
      />
    </mesh>
  );
}

function GlobeWireframe() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[GLOBE_RADIUS + 0.002, 24, 24]} />
      <meshBasicMaterial
        color={new THREE.Color(0x1a0050)}
        wireframe
        transparent
        opacity={0.15}
      />
    </mesh>
  );
}

function NodeDots() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001;
    }
  });

  return (
    <group ref={groupRef}>
      {NODES.map((node) => {
        const pos = latLonToVector3(node.lat, node.lon, GLOBE_RADIUS + 0.015);
        return (
          <mesh key={node.name} position={pos}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshBasicMaterial
              color={new THREE.Color(0x00ff88)}
            />
          </mesh>
        );
      })}
      {/* Glowing halos around nodes */}
      {NODES.map((node) => {
        const pos = latLonToVector3(node.lat, node.lon, GLOBE_RADIUS + 0.014);
        return (
          <mesh key={`halo-${node.name}`} position={pos}>
            <sphereGeometry args={[0.030, 8, 8]} />
            <meshBasicMaterial
              color={new THREE.Color(0x00ff88)}
              transparent
              opacity={0.15}
            />
          </mesh>
        );
      })}
    </group>
  );
}

interface Arc {
  id: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  progress: number;
  opacity: number;
  phase: 'growing' | 'fading';
  points: THREE.Vector3[];
}

function ArcLines() {
  const [arcs, setArcs] = useState<Arc[]>([]);
  const arcIdRef = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const spawnArc = () => {
      const fromIdx = Math.floor(Math.random() * NODES.length);
      let toIdx = Math.floor(Math.random() * NODES.length);
      while (toIdx === fromIdx) toIdx = Math.floor(Math.random() * NODES.length);

      const from = latLonToVector3(NODES[fromIdx].lat, NODES[fromIdx].lon, GLOBE_RADIUS + 0.02);
      const to = latLonToVector3(NODES[toIdx].lat, NODES[toIdx].lon, GLOBE_RADIUS + 0.02);

      // Create arc points via slerp
      const points: THREE.Vector3[] = [];
      const numPoints = 40;
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const v = new THREE.Vector3().lerpVectors(from, to, t);
        // Lift the midpoint up to form an arc above the globe
        const lift = Math.sin(t * Math.PI) * 0.4;
        v.normalize().multiplyScalar(GLOBE_RADIUS + 0.02 + lift);
        points.push(v);
      }

      const newArc: Arc = {
        id: arcIdRef.current++,
        from,
        to,
        progress: 0,
        opacity: 1,
        phase: 'growing',
        points,
      };

      setArcs((prev) => [...prev.slice(-6), newArc]);
    };

    const interval = setInterval(spawnArc, 3000);
    spawnArc(); // Spawn immediately
    return () => clearInterval(interval);
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001;
    }
    setArcs((prev) =>
      prev
        .map((arc) => {
          if (arc.phase === 'growing') {
            const newProgress = arc.progress + delta / 1.5;
            if (newProgress >= 1) {
              return { ...arc, progress: 1, phase: 'fading' as const };
            }
            return { ...arc, progress: newProgress };
          } else {
            const newOpacity = arc.opacity - delta / 0.8;
            if (newOpacity <= 0) return null;
            return { ...arc, opacity: newOpacity };
          }
        })
        .filter(Boolean) as Arc[]
    );
  });

  return (
    <group ref={groupRef}>
      {arcs.map((arc) => {
        const visibleCount = Math.floor(arc.progress * arc.points.length);
        if (visibleCount < 2) return null;
        const visiblePoints = arc.points.slice(0, visibleCount);
        const geometry = new THREE.BufferGeometry().setFromPoints(visiblePoints);
        const material = new THREE.LineBasicMaterial({
          color: new THREE.Color(0x9945ff),
          transparent: true,
          opacity: arc.opacity * 0.9,
        });
        const lineObj = new THREE.Line(geometry, material);

        return <primitive key={arc.id} object={lineObj} />;
      })}
    </group>
  );
}

function Starfield() {
  const points = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 2000; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 4 + Math.random() * 6;
      pts.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    return new Float32Array(pts);
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(points, 3));
    return geo;
  }, [points]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color={0x334466} size={0.012} sizeAttenuation />
    </points>
  );
}

export default function Globe() {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.5], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.1} />
      <pointLight position={[5, 5, 5]} intensity={0.8} color={0x9945ff} />
      <pointLight position={[-5, -5, 5]} intensity={0.3} color={0x00ff88} />
      <directionalLight position={[0, 1, 2]} intensity={0.2} />

      <Starfield />
      <GlobeSphere />
      <GlobeWireframe />
      <NodeDots />
      <ArcLines />

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={1.8}
        maxDistance={5}
        autoRotate={true}
        enableDamping
        dampingFactor={0.05}
      />
    </Canvas>
  );
}
