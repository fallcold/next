'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import styles from './page.module.css';

const VERTEX_SHADER = `
attribute float size;
attribute vec3 customColor;
attribute float opacityAttr;
attribute float orbitSpeed;
attribute float isRing;
attribute float aRandomId;

varying vec3 vColor;
varying float vDist;
varying float vOpacity;
varying float vScaleFactor;
varying float vIsRing;

uniform float uTime;
uniform float uScale;
uniform float uRotationX;

mat2 rotate2d(float _angle){
  return mat2(cos(_angle),-sin(_angle),sin(_angle),cos(_angle));
}

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  float normScaleLOD = clamp((uScale - 0.15) / 2.35, 0.0, 1.0);
  float visibilityThreshold = 0.9 + pow(normScaleLOD, 1.2) * 0.1;

  if (aRandomId > visibilityThreshold) {
    gl_Position = vec4(0.0);
    gl_PointSize = 0.0;
    return;
  }

  vec3 pos = position;

  if (isRing > 0.5) {
    float angleOffset = uTime * orbitSpeed * 0.2;
    vec2 rotatedXZ = rotate2d(angleOffset) * pos.xz;
    pos.x = rotatedXZ.x;
    pos.z = rotatedXZ.y;
  } else {
    float bodyAngle = uTime * 0.03;
    vec2 rotatedXZ = rotate2d(bodyAngle) * pos.xz;
    pos.x = rotatedXZ.x;
    pos.z = rotatedXZ.y;
  }

  float cx = cos(uRotationX);
  float sx = sin(uRotationX);
  float ry = pos.y * cx - pos.z * sx;
  float rz = pos.y * sx + pos.z * cx;
  pos.y = ry;
  pos.z = rz;

  vec4 mvPosition = modelViewMatrix * vec4(pos * uScale, 1.0);
  float dist = -mvPosition.z;
  vDist = dist;

  float chaosThreshold = 25.0;
  if (dist < chaosThreshold && dist > 0.1) {
    float chaosIntensity = 1.0 - (dist / chaosThreshold);
    chaosIntensity = pow(chaosIntensity, 3.0);

    float highFreqTime = uTime * 40.0;
    float noiseX = sin(highFreqTime + pos.x * 10.0) * hash(pos.y);
    float noiseY = cos(highFreqTime + pos.y * 10.0) * hash(pos.x);
    float noiseZ = sin(highFreqTime * 0.5) * hash(pos.z);

    vec3 noiseVec = vec3(noiseX, noiseY, noiseZ) * chaosIntensity * 3.0;
    mvPosition.xyz += noiseVec;
  }

  gl_Position = projectionMatrix * mvPosition;

  float pointSize = size * (350.0 / dist);
  pointSize *= 0.55;

  if (isRing < 0.5 && dist < 50.0) {
    pointSize *= 0.8;
  }

  gl_PointSize = clamp(pointSize, 0.0, 300.0);

  vColor = customColor;
  vOpacity = opacityAttr;
  vScaleFactor = uScale;
  vIsRing = isRing;
}`;

const FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vDist;
varying float vOpacity;
varying float vScaleFactor;
varying float vIsRing;

void main() {
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  float r = dot(cxy, cxy);
  if (r > 1.0) discard;

  float glow = smoothstep(1.0, 0.4, r);
  float t = clamp((vScaleFactor - 0.15) / 2.35, 0.0, 1.0);

  vec3 deepGold = vec3(0.35, 0.22, 0.05);
  float colorMix = smoothstep(0.1, 0.9, t);
  vec3 baseColor = mix(deepGold, vColor, colorMix);
  float brightness = 0.2 + 1.0 * t;
  float densityAlpha = 0.25 + 0.45 * smoothstep(0.0, 0.5, t);
  vec3 finalColor = baseColor * brightness;

  if (vDist < 40.0) {
    float closeMix = 1.0 - (vDist / 40.0);
    if (vIsRing < 0.5) {
      vec3 deepTexture = pow(vColor, vec3(1.4)) * 1.5;
      finalColor = mix(finalColor, deepTexture, closeMix * 0.8);
    } else {
      finalColor += vec3(0.15, 0.12, 0.1) * closeMix;
    }
  }

  float depthAlpha = 1.0;
  if (vDist < 10.0) depthAlpha = smoothstep(0.0, 10.0, vDist);

  float alpha = glow * vOpacity * densityAlpha * depthAlpha;
  gl_FragColor = vec4(finalColor, alpha);
}`;

const STAR_VERTEX = `
attribute float size;
attribute vec3 customColor;
varying vec3 vColor;
uniform float uTime;
void main() {
  vColor = customColor;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float dist = -mvPosition.z;
  gl_PointSize = size * (1000.0 / dist);
  gl_PointSize = clamp(gl_PointSize, 1.0, 8.0);
  gl_Position = projectionMatrix * mvPosition;
}`;

const STAR_FRAGMENT = `
varying vec3 vColor;
uniform float uTime;
float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
void main() {
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  float r = dot(cxy, cxy);
  if (r > 1.0) discard;
  float noise = random(gl_FragCoord.xy);
  float twinkle = 0.7 + 0.3 * sin(uTime * 2.0 + noise * 10.0);
  float glow = 1.0 - r;
  glow = pow(glow, 1.5);
  gl_FragColor = vec4(vColor * twinkle, glow * 0.8);
}`;

const PLANET_VERTEX = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}`;

const PLANET_FRAGMENT = `
uniform vec3 color1;
uniform vec3 color2;
uniform float noiseScale;
uniform vec3 lightDir;
uniform float atmosphere;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 st) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(st);
    st *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}
void main() {
  float n = fbm(vUv * noiseScale);
  vec3 albedo = mix(color1, color2, n);
  vec3 normal = normalize(vNormal);
  vec3 light = normalize(lightDir);
  float diff = max(dot(normal, light), 0.05);
  vec3 viewDir = normalize(vViewPosition);
  float fresnel = pow(1.0 - dot(viewDir, normal), 3.0);
  vec3 finalColor = albedo * diff + atmosphere * vec3(0.5, 0.6, 1.0) * fresnel;
  gl_FragColor = vec4(finalColor, 1.0);
}`;

export default function HomePage() {
  const containerRef = useRef(null);
  const statusRef = useRef(null);
  const loadingRef = useRef(null);
  const [threeReady, setThreeReady] = useState(false);

  useEffect(() => {
    if (!threeReady || !containerRef.current || !window.THREE) return;

    const THREE = window.THREE;
    let animationId;
    let scene;
    let camera;
    let renderer;
    let particles;
    let stars;
    let nebula;
    let planetGroup;
    let uniforms;
    let starUniforms;

    let targetScale = 1.0;
    let targetRotX = 0.4;
    let currentScale = 1.0;
    let currentRotX = 0.4;
    let isMouseActive = false;
    let autoIdleTime = 0;

    const clock = new THREE.Clock();
    const container = containerRef.current;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    function createPlanet(group, c1, c2, nScale, pos, radius, atmo) {
      const geo = new THREE.SphereGeometry(radius, 48, 48);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          color1: { value: c1 },
          color2: { value: c2 },
          noiseScale: { value: nScale },
          lightDir: { value: new THREE.Vector3(1, 0.5, 1) },
          atmosphere: { value: atmo },
        },
        vertexShader: PLANET_VERTEX,
        fragmentShader: PLANET_FRAGMENT,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      group.add(mesh);
    }

    function initPlanets() {
      planetGroup = new THREE.Group();
      scene.add(planetGroup);

      createPlanet(
        planetGroup,
        new THREE.Color('#b33a00'),
        new THREE.Color('#d16830'),
        8.0,
        { x: -300, y: 120, z: -450 },
        10,
        0.3
      );
      createPlanet(
        planetGroup,
        new THREE.Color('#001e4d'),
        new THREE.Color('#ffffff'),
        5.0,
        { x: 380, y: -100, z: -600 },
        14,
        0.6
      );
      createPlanet(
        planetGroup,
        new THREE.Color('#666666'),
        new THREE.Color('#aaaaaa'),
        15.0,
        { x: -180, y: -220, z: -350 },
        6,
        0.1
      );
    }

    function initSaturn() {
      const particleCount = 240000;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);
      const opacities = new Float32Array(particleCount);
      const orbitSpeeds = new Float32Array(particleCount);
      const isRings = new Float32Array(particleCount);
      const randomIds = new Float32Array(particleCount);

      const bodyColors = [new THREE.Color('#E3DAC5'), new THREE.Color('#C9A070'), new THREE.Color('#E3DAC5'), new THREE.Color('#B08D55')];
      const colorRingC = new THREE.Color('#2A2520');
      const colorRingB_Inner = new THREE.Color('#CDBFA0');
      const colorRingB_Outer = new THREE.Color('#DCCBBA');
      const colorCassini = new THREE.Color('#050505');
      const colorRingA = new THREE.Color('#989085');
      const colorRingF = new THREE.Color('#AFAFA0');
      const R_PLANET = 18;

      for (let i = 0; i < particleCount; i += 1) {
        let x;
        let y;
        let z;
        let r;
        let g;
        let b;
        let size;
        let opacity;
        let speed;
        let isRingVal;
        randomIds[i] = Math.random();

        if (i < particleCount * 0.25) {
          isRingVal = 0.0;
          speed = 0.0;
          const u = Math.random();
          const v = Math.random();
          const theta = 2 * Math.PI * u;
          const phi = Math.acos(2 * v - 1);
          const rad = R_PLANET;

          x = rad * Math.sin(phi) * Math.cos(theta);
          const rawY = rad * Math.cos(phi);
          z = rad * Math.sin(phi) * Math.sin(theta);
          y = rawY * 0.9;

          const lat = (rawY / rad + 1.0) * 0.5;
          const bandNoise = Math.cos(lat * 40.0) * 0.8 + Math.cos(lat * 15.0) * 0.4;
          let colIndex = Math.floor(lat * 4 + bandNoise) % 4;
          if (colIndex < 0) colIndex = 0;
          const baseCol = bodyColors[colIndex];

          r = baseCol.r;
          g = baseCol.g;
          b = baseCol.b;
          size = 1.0 + Math.random() * 0.8;
          opacity = 0.8;
        } else {
          isRingVal = 1.0;
          const zoneRand = Math.random();
          let ringRadius;
          let ringCol;

          if (zoneRand < 0.15) {
            ringRadius = R_PLANET * (1.235 + Math.random() * (1.525 - 1.235));
            ringCol = colorRingC;
            size = 0.5;
            opacity = 0.3;
          } else if (zoneRand < 0.65) {
            const t = Math.random();
            ringRadius = R_PLANET * (1.525 + t * (1.95 - 1.525));
            ringCol = colorRingB_Inner.clone().lerp(colorRingB_Outer, t);
            size = 0.8 + Math.random() * 0.6;
            opacity = 0.85;
            if (Math.sin(ringRadius * 2.0) > 0.8) opacity *= 1.2;
          } else if (zoneRand < 0.69) {
            ringRadius = R_PLANET * (1.95 + Math.random() * (2.025 - 1.95));
            ringCol = colorCassini;
            size = 0.3;
            opacity = 0.1;
          } else if (zoneRand < 0.99) {
            ringRadius = R_PLANET * (2.025 + Math.random() * (2.27 - 2.025));
            ringCol = colorRingA;
            size = 0.7;
            opacity = 0.6;
            if (ringRadius > R_PLANET * 2.2 && ringRadius < R_PLANET * 2.21) opacity = 0.1;
          } else {
            ringRadius = R_PLANET * (2.32 + Math.random() * 0.02);
            ringCol = colorRingF;
            size = 1.0;
            opacity = 0.7;
          }

          const theta = Math.random() * Math.PI * 2;
          x = ringRadius * Math.cos(theta);
          z = ringRadius * Math.sin(theta);
          let thickness = 0.15;
          if (ringRadius > R_PLANET * 2.3) thickness = 0.4;
          y = (Math.random() - 0.5) * thickness;

          r = ringCol.r;
          g = ringCol.g;
          b = ringCol.b;
          speed = 8.0 / Math.sqrt(ringRadius);
        }

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
        sizes[i] = size;
        opacities[i] = opacity;
        orbitSpeeds[i] = speed;
        isRings[i] = isRingVal;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      geometry.setAttribute('opacityAttr', new THREE.BufferAttribute(opacities, 1));
      geometry.setAttribute('orbitSpeed', new THREE.BufferAttribute(orbitSpeeds, 1));
      geometry.setAttribute('isRing', new THREE.BufferAttribute(isRings, 1));
      geometry.setAttribute('aRandomId', new THREE.BufferAttribute(randomIds, 1));

      uniforms = {
        uTime: { value: 0 },
        uScale: { value: 1.0 },
        uRotationX: { value: 0.4 },
      };

      const material = new THREE.ShaderMaterial({
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
      });

      particles = new THREE.Points(geometry, material);
      particles.rotation.z = 26.73 * (Math.PI / 180);
      scene.add(particles);
    }

    function initStarfield() {
      const starCount = 30000;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(starCount * 3);
      const cols = new Float32Array(starCount * 3);
      const sizes = new Float32Array(starCount);

      const starColors = [new THREE.Color('#9bb0ff'), new THREE.Color('#ffffff'), new THREE.Color('#ffcc6f'), new THREE.Color('#ff7b7b')];

      for (let i = 0; i < starCount; i += 1) {
        const r = 400 + Math.random() * 3000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.cos(phi);
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        const colorType = Math.random();
        let c;
        if (colorType > 0.9) c = starColors[0];
        else if (colorType > 0.6) c = starColors[1];
        else if (colorType > 0.3) c = starColors[2];
        else c = starColors[3];

        cols[i * 3] = c.r;
        cols[i * 3 + 1] = c.g;
        cols[i * 3 + 2] = c.b;
        sizes[i] = 1.0 + Math.random() * 3.0;
      }

      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('customColor', new THREE.BufferAttribute(cols, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      starUniforms = { uTime: { value: 0 } };
      const mat = new THREE.ShaderMaterial({
        uniforms: starUniforms,
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      stars = new THREE.Points(geo, mat);
      scene.add(stars);

      const nebulaCount = 100;
      const nebGeo = new THREE.BufferGeometry();
      const nebPos = new Float32Array(nebulaCount * 3);
      const nebCols = new Float32Array(nebulaCount * 3);
      const nebSizes = new Float32Array(nebulaCount);

      for (let i = 0; i < nebulaCount; i += 1) {
        const r = 800 + Math.random() * 2000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        nebPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        nebPos[i * 3 + 1] = r * Math.cos(phi);
        nebPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        const nc = new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.8, 0.05);
        nebCols[i * 3] = nc.r;
        nebCols[i * 3 + 1] = nc.g;
        nebCols[i * 3 + 2] = nc.b;
        nebSizes[i] = 400.0 + Math.random() * 600.0;
      }

      nebGeo.setAttribute('position', new THREE.BufferAttribute(nebPos, 3));
      nebGeo.setAttribute('customColor', new THREE.BufferAttribute(nebCols, 3));
      nebGeo.setAttribute('size', new THREE.BufferAttribute(nebSizes, 1));

      const nebShaderMat = new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: STAR_VERTEX,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            float r = dot(cxy, cxy);
            if(r > 1.0) discard;
            float glow = pow(1.0 - r, 2.0);
            gl_FragColor = vec4(vColor, glow * 0.1);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      nebula = new THREE.Points(nebGeo, nebShaderMat);
      scene.add(nebula);
    }

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020202, 0.00015);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 100;
    camera.lookAt(0, 0, 0);

    initSaturn();
    initStarfield();
    initPlanets();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const onMouseMove = (event) => {
      isMouseActive = true;
      const normY = event.clientY / window.innerHeight;
      targetRotX = -0.6 + (1 - normY) * 1.6;
      if (statusRef.current) {
        statusRef.current.innerHTML = "系统状态: 鼠标操控<br>输入信号: <span class='highlight'>已锁定</span>";
      }
    };

    const onWheel = (event) => {
      isMouseActive = true;
      targetScale = clamp(targetScale + event.deltaY * -0.0012, 0.15, 2.5);
    };

    let dragging = false;
    const onMouseDown = () => {
      dragging = true;
      isMouseActive = true;
    };
    const onMouseUp = () => {
      dragging = false;
    };
    const onMouseDrag = (event) => {
      if (!dragging) return;
      targetScale = clamp(targetScale + event.movementX * 0.003, 0.15, 2.5);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseDrag);

    if (loadingRef.current) loadingRef.current.style.display = 'none';

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      uniforms.uTime.value = elapsedTime;
      if (starUniforms) starUniforms.uTime.value = elapsedTime;

      if (stars) stars.rotation.y = elapsedTime * 0.005;
      if (nebula) nebula.rotation.y = elapsedTime * 0.003;

      if (planetGroup) {
        planetGroup.children.forEach((planet, idx) => {
          planet.rotation.y = elapsedTime * (0.05 + idx * 0.02);
        });
        planetGroup.rotation.y = Math.sin(elapsedTime * 0.05) * 0.02;
      }

      if (!isMouseActive) {
        autoIdleTime += 0.005;
        targetScale = 1.0 + Math.sin(autoIdleTime) * 0.2;
        targetRotX = 0.4 + Math.sin(autoIdleTime * 0.3) * 0.15;
        if (statusRef.current) statusRef.current.innerHTML = '系统状态: 自动巡航<br>输入信号: 等待鼠标操作...';
      }

      const lerpFactor = 0.08;
      currentScale += (targetScale - currentScale) * lerpFactor;
      currentRotX += (targetRotX - currentRotX) * lerpFactor;
      uniforms.uScale.value = currentScale;
      uniforms.uRotationX.value = currentRotX;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseDrag);
      if (renderer?.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer?.dispose();
    };
  }, [threeReady]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" strategy="beforeInteractive" onLoad={() => setThreeReady(true)} />

      <div className={styles.canvasContainer} ref={containerRef} />

      <a id="author-btn" className={styles.authorBtn} href="https://www.yjln.com" target="_blank" rel="noreferrer">
        By Mr.lun
      </a>

      <div className={styles.fpsCounter}>渲染模式: 粒子土星 | 操作方式: 鼠标移动/滚轮缩放/拖拽微调</div>

      <div id="loading" className={styles.loading} ref={loadingRef}>
        正在构建粒子与行星数据...
      </div>

      <div className={styles.uiLayer}>
        <div className={styles.glassPanel}>
          <h1>土星</h1>
          <div className={styles.statusText} ref={statusRef}>
            系统状态: 待机
            <br />
            输入信号: 等待鼠标操作...
            <br />
            <br />
            {'>'} 开普勒轨道: 运行中
            <br />
            {'>'} 粒子总数: 24万+
            <br />
            {'>'} 背景环境: 行星已加载
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <button type="button" onClick={toggleFullScreen}>
          全屏沉浸体验
        </button>
      </div>
    </>
  );
}
