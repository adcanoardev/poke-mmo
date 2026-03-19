// apps/client/src/pages/NexusPage.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../components/PageShell";
import PageTopbar from "../components/PageTopbar";
import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────

type Rarity = "COMMON" | "RARE" | "EPIC" | "ELITE" | "LEGENDARY" | "MYTHIC";
interface Banner { id: number; startsAt: string; endsAt: string; boostedMythIds: string[]; boostedMythNames?: string[]; isActive: boolean; }
interface PityData { essences: number; pityRare: number; pityEpic: number; pityElite: number; pityLegendary: number; }
interface PullResult { speciesId: string; name: string; rarity: Rarity; affinities: string[]; level: number; maxHp: number; attack: number; defense: number; speed: number; instanceId: string; isPityGuarantee: boolean; }

// ─── Rarity config ────────────────────────────────────────────

const RS: Record<Rarity, { color: string; border: string; bg: string; glow: string; bgR: string; label: string; p: string; hex: number }> = {
    COMMON:    { color: "#e2e8f0", border: "#64748b", bg: "rgba(71,85,105,0.3)",   glow: "rgba(148,163,184,0.9)",  bgR: "rgba(100,116,139,0.12)", label: "Common",    p: "#94a3b8", hex: 0x94a3b8 },
    RARE:      { color: "#c7d2fe", border: "#6366f1", bg: "rgba(67,56,202,0.35)",  glow: "rgba(99,102,241,0.95)",  bgR: "rgba(99,102,241,0.2)",   label: "Rare",      p: "#818cf8", hex: 0x6366f1 },
    EPIC:      { color: "#e9d5ff", border: "#a855f7", bg: "rgba(126,34,206,0.35)", glow: "rgba(168,85,247,0.95)",  bgR: "rgba(168,85,247,0.25)",  label: "Epic",      p: "#c084fc", hex: 0xa855f7 },
    ELITE:     { color: "#f1f5f9", border: "#94a3b8", bg: "rgba(30,41,59,0.6)",    glow: "rgba(226,232,240,0.9)",  bgR: "rgba(148,163,184,0.15)", label: "Elite",     p: "#e2e8f0", hex: 0xe2e8f0 },
    LEGENDARY: { color: "#fde68a", border: "#fbbf24", bg: "rgba(180,83,9,0.35)",   glow: "rgba(251,191,36,1.0)",   bgR: "rgba(251,191,36,0.25)",  label: "Legendary", p: "#fbbf24", hex: 0xfbbf24 },
    MYTHIC:    { color: "#fca5a5", border: "#f87171", bg: "rgba(185,28,28,0.35)",   glow: "rgba(248,113,113,0.95)", bgR: "rgba(248,113,113,0.2)",  label: "Mythic",    p: "#f87171", hex: 0xf87171 },
};

const PITY_KEYS = [
    { key: "pityRare",      label: "Rare",      color: "#6366f1", max: 10  },
    { key: "pityEpic",      label: "Epic",      color: "#a855f7", max: 30  },
    { key: "pityElite",     label: "Elite",     color: "#94a3b8", max: 100 },
    { key: "pityLegendary", label: "Legendary", color: "#fbbf24", max: 150 },
];

const CDN = "https://cdn.jsdelivr.net/gh/adcanoardev/mythara-assets@7613486785dc2b2089f6d345e1281e9316c1d982";
const SPARKLES = [
    { top: "14%", left: "10%", fs: 10, delay: "0.2s" },
    { top: "22%", left: "76%", fs: 7,  delay: "0.8s" },
    { top: "10%", left: "62%", fs: 12, delay: "1.3s" },
    { top: "32%", left: "6%",  fs: 6,  delay: "0.5s" },
];

function daysLeft(e: string) { return Math.max(0, Math.ceil((new Date(e).getTime() - Date.now()) / 86400000)); }
function mythFrontUrl(id: string, slug: string) { return `${CDN}/myths/${id}/${slug}_front.png`; }
function affinityUrl(a: string) { return `${CDN}/affinity/${a}_affinity_icon.webp`; }
function toSlug(s: string) { return s.toLowerCase().replace(/\s+/g, "_"); }

// ─── Three.js loader ──────────────────────────────────────────

let _threeP: Promise<any> | null = null;
function loadThree(): Promise<any> {
    if ((window as any).THREE) return Promise.resolve((window as any).THREE);
    if (_threeP) return _threeP;
    _threeP = new Promise(res => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
        s.onload = () => res((window as any).THREE);
        document.head.appendChild(s);
    });
    return _threeP;
}

// ─── Three.js Fullscreen Burst ────────────────────────────────

function FullScreenBurst({ color, onDone, x, y }: { color: number; onDone: () => void; x?: number; y?: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        let mounted = true;
        loadThree().then((THREE) => {
            if (!mounted || !canvasRef.current) return;
            const canvas = canvasRef.current;
            const W = window.innerWidth, H = window.innerHeight;
            canvas.width = W; canvas.height = H;
            canvas.style.width = W + "px"; canvas.style.height = H + "px";
            const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
            renderer.setSize(W, H, false);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setClearColor(0x000000, 0);
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
            camera.position.z = 5;

            // Offset para centrar el burst en la posición del cristal
            const offsetX = x !== undefined ? ((x - W / 2) / W) * 10 : 0;
            const offsetY = y !== undefined ? -((y - H / 2) / H) * 8 : 0;

            const threeColor = new THREE.Color(color);
            const count = 320;
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(count * 3);
            const vel: { x: number; y: number; z: number }[] = [];
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * Math.PI;
                const spd = 0.05 + Math.random() * 0.15;
                vel.push({ x: Math.cos(a) * Math.cos(e) * spd, y: Math.sin(e) * spd, z: Math.sin(a) * Math.cos(e) * spd * 0.3 });
                pos[i * 3] = offsetX; pos[i * 3 + 1] = offsetY; pos[i * 3 + 2] = 0;
            }
            geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
            const mat = new THREE.PointsMaterial({ color: threeColor, size: 0.1, transparent: true, opacity: 1 });
            scene.add(new THREE.Points(geo, mat));
            const rings: any[] = [];
            for (let r = 0; r < 6; r++) {
                const rGeo = new THREE.RingGeometry(0.08 + r * 0.45, 0.1 + r * 0.45, 72);
                const rMat = new THREE.MeshBasicMaterial({ color: r % 2 === 0 ? threeColor : new THREE.Color(0xffffff), side: THREE.DoubleSide, transparent: true, opacity: 0.8 - r * 0.08 });
                const ring = new THREE.Mesh(rGeo, rMat);
                ring.position.x = offsetX; ring.position.y = offsetY;
                ring.rotation.x = Math.random() * Math.PI; ring.rotation.y = Math.random() * Math.PI;
                scene.add(ring);
                rings.push({ mesh: ring, speed: 0.005 + r * 0.003 });
            }
            const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
            const flash = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), flashMat);
            flash.position.x = offsetX; flash.position.y = offsetY;
            scene.add(flash);
            let frame = 0;
            let raf: number;
            function animate() {
                if (!mounted) return;
                raf = requestAnimationFrame(animate);
                frame++;
                flashMat.opacity = Math.max(0, 0.9 - frame * 0.06);
                const arr = geo.attributes.position.array as Float32Array;
                for (let i = 0; i < count; i++) { arr[i*3]+=vel[i].x; arr[i*3+1]+=vel[i].y; arr[i*3+2]+=vel[i].z; vel[i].y -= 0.001; }
                geo.attributes.position.needsUpdate = true;
                mat.opacity = Math.max(0, mat.opacity - 0.007);
                rings.forEach(({ mesh, speed }) => {
                    mesh.rotation.z += speed; mesh.rotation.x += speed * 0.7;
                    mesh.scale.setScalar(1 + frame * 0.055);
                    mesh.material.opacity = Math.max(0, mesh.material.opacity - 0.012);
                });
                renderer.render(scene, camera);
                if (frame > 120) { mounted = false; cancelAnimationFrame(raf); renderer.dispose(); onDone(); }
            }
            animate();
        });
        return () => { mounted = false; };
    }, [color, x, y]);
    return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 290, background: "transparent" }} />;
}

// ─── CSS particles ────────────────────────────────────────────

function cssParticles(c: HTMLElement, color: string, n = 22) {
    for (let i = 0; i < n; i++) {
        const p = document.createElement("div");
        const a = (i / n) * Math.PI * 2, d = 55 + Math.random() * 90, sz = 2 + Math.random() * 5;
        Object.assign(p.style, {
            position: "absolute", width: `${sz}px`, height: `${sz}px`,
            background: color, top: "50%", left: "50%", pointerEvents: "none", zIndex: "15",
            clipPath: i % 3 === 0 ? "polygon(50% 0%,100% 50%,50% 100%,0% 50%)" : undefined,
            borderRadius: i % 3 === 0 ? undefined : "50%",
            animation: `nxPart ${0.5 + Math.random() * 0.7}s ease-out ${Math.random() * 0.1}s both`,
            ["--tx" as any]: `${Math.cos(a) * d}px`, ["--ty" as any]: `${Math.sin(a) * d}px`,
        });
        c.appendChild(p); setTimeout(() => p.remove(), 1500);
    }
}

// ─── Essence: partículas flotando que forman un fragmento ─────

function EssenceFragment({ size }: { size: number }) {
    const h = size / 2;
    // 28 partículas distribuidas en la silueta de un fragmento/cristal
    const particles = Array.from({ length: 28 }, (_, i) => {
        // Posiciones que forman la silueta de un fragmento
        const t = (i / 28) * Math.PI * 2;
        // Forma de fragmento irregular: radio variable
        const r = h * (0.38 + 0.22 * Math.abs(Math.sin(t * 2.5)) + 0.08 * Math.sin(t * 4));
        return {
            x: h + Math.cos(t) * r * (0.75 + 0.25 * Math.random()),
            y: h + Math.sin(t) * r * (0.85 + 0.15 * Math.random()) - h * 0.05,
            size: 2 + Math.random() * 4,
            color: i % 5 === 0 ? "#ffffff" : i % 5 === 1 ? "#c4b5fd" : i % 5 === 2 ? "#67e8f9" : i % 5 === 3 ? "#a78bfa" : "#7b2fff",
            dur: `${1.8 + Math.random() * 2.4}s`,
            delay: `${-i * 0.22}s`,
            amp: 3 + Math.random() * 5, // amplitud del float
        };
    });

    // Partículas internas más pequeñas que flotan libremente
    const innerParticles = Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const r = h * (0.1 + Math.random() * 0.28);
        return {
            x: h + Math.cos(angle) * r,
            y: h + Math.sin(angle) * r,
            size: 1 + Math.random() * 2.5,
            color: i % 3 === 0 ? "#e0d4ff" : i % 3 === 1 ? "#67e8f9" : "#c4b5fd",
            dur: `${1.2 + Math.random() * 1.8}s`,
            delay: `${-Math.random() * 3}s`,
            amp: 6 + Math.random() * 8,
        };
    });

    return (
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
            {/* Glow radial de fondo — perfectamente redondo, sin bordes */}
            <div style={{
                position: "absolute",
                inset: -size * 0.22,
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(123,47,255,0.22) 0%, rgba(76,201,240,0.08) 40%, transparent 68%)`,
                animation: "nxGlow 3.5s ease-in-out infinite",
                pointerEvents: "none",
            }} />

            {/* SVG: silueta central del fragmento (wireframe translúcido) */}
            <svg viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
                <defs>
                    <radialGradient id="fragCore" cx="40%" cy="35%" r="65%">
                        <stop offset="0%"   stopColor="rgba(220,200,255,0.85)" />
                        <stop offset="35%"  stopColor="rgba(123,47,255,0.55)" />
                        <stop offset="75%"  stopColor="rgba(76,201,240,0.2)" />
                        <stop offset="100%" stopColor="rgba(7,11,20,0)" />
                    </radialGradient>
                    <filter id="fragBlur"><feGaussianBlur stdDeviation="2.5" /></filter>
                    <filter id="fragBlur2"><feGaussianBlur stdDeviation="1" /></filter>
                </defs>
                {/* Glow suave detrás */}
                <polygon
                    points={`${h},${h*0.12} ${h*1.55},${h*0.72} ${h*1.38},${h*1.82} ${h*0.62},${h*1.82} ${h*0.45},${h*0.72}`}
                    fill="rgba(123,47,255,0.18)"
                    filter="url(#fragBlur)"
                />
                {/* Fragmento principal */}
                <polygon
                    points={`${h},${h*0.14} ${h*1.52},${h*0.74} ${h*1.35},${h*1.78} ${h*0.65},${h*1.78} ${h*0.48},${h*0.74}`}
                    fill="url(#fragCore)"
                    stroke="rgba(167,139,250,0.4)"
                    strokeWidth="0.8"
                >
                    <animateTransform attributeName="transform" type="rotate" from={`0 ${h} ${h}`} to={`360 ${h} ${h}`} dur="18s" repeatCount="indefinite" />
                </polygon>
                {/* Líneas internas de faceta */}
                <line x1={h} y1={h*0.14} x2={h} y2={h*1.78} stroke="rgba(167,139,250,0.15)" strokeWidth="0.6" />
                <line x1={h*0.48} y1={h*0.74} x2={h*1.52} y2={h*0.74} stroke="rgba(76,201,240,0.12)" strokeWidth="0.5" />
                {/* Shine */}
                <ellipse cx={h*0.78} cy={h*0.48} rx={h*0.1} ry={h*0.06} fill="rgba(255,255,255,0.55)" filter="url(#fragBlur2)" />
                {/* Pulsos */}
                <circle cx={h} cy={h} r={h*0.22} fill="none" stroke="rgba(123,47,255,0.4)" strokeWidth="0.8">
                    <animate attributeName="r" values={`${h*0.22};${h*0.75};${h*0.22}`} dur="2.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="2.6s" repeatCount="indefinite" />
                </circle>
                <circle cx={h} cy={h} r={h*0.22} fill="none" stroke="rgba(76,201,240,0.3)" strokeWidth="0.6">
                    <animate attributeName="r" values={`${h*0.22};${h*0.75};${h*0.22}`} dur="2.6s" begin="0.85s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0;0.4" dur="2.6s" begin="0.85s" repeatCount="indefinite" />
                </circle>
            </svg>

            {/* Partículas flotantes del contorno */}
            {particles.map((p, i) => (
                <div key={`o${i}`} style={{
                    position: "absolute",
                    width: p.size, height: p.size,
                    borderRadius: "50%",
                    background: p.color,
                    left: p.x - p.size / 2,
                    top: p.y - p.size / 2,
                    pointerEvents: "none",
                    boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                    animation: `nxFragFloat${i % 4} ${p.dur} ease-in-out ${p.delay} infinite`,
                }} />
            ))}

            {/* Partículas internas */}
            {innerParticles.map((p, i) => (
                <div key={`in${i}`} style={{
                    position: "absolute",
                    width: p.size, height: p.size,
                    borderRadius: "50%",
                    background: p.color,
                    left: p.x - p.size / 2,
                    top: p.y - p.size / 2,
                    pointerEvents: "none",
                    opacity: 0.7,
                    animation: `nxFragFloat${(i + 2) % 4} ${p.dur} ease-in-out ${p.delay} infinite`,
                }} />
            ))}
        </div>
    );
}

// ─── Mini fragmento x5 ────────────────────────────────────────

function MiniFragment({ dim }: { dim: boolean }) {
    return (
        <svg viewBox="0 0 72 72" width={72} height={72} style={{ display: "block", overflow: "visible", opacity: dim ? 0.28 : 1, transition: "opacity 0.4s", filter: dim ? "none" : "drop-shadow(0 0 8px rgba(123,47,255,0.9)) drop-shadow(0 0 18px rgba(76,201,240,0.35))" }}>
            <defs>
                <radialGradient id="mfg" cx="38%" cy="30%" r="70%">
                    <stop offset="0%"   stopColor="rgba(220,200,255,0.95)" stopOpacity={dim ? "0.18" : "1"} />
                    <stop offset="40%"  stopColor="rgba(123,47,255,0.8)"   stopOpacity={dim ? "0.14" : "1"} />
                    <stop offset="80%"  stopColor="rgba(76,201,240,0.4)"   stopOpacity={dim ? "0.1"  : "1"} />
                    <stop offset="100%" stopColor="rgba(7,11,20,0)"        stopOpacity="1" />
                </radialGradient>
                <filter id="mfbl"><feGaussianBlur stdDeviation="1" /></filter>
            </defs>
            {/* Glow */}
            <polygon points="36,4 58,28 50,68 22,68 14,28" fill="rgba(123,47,255,0.2)" filter="url(#mfbl)" />
            {/* Fragmento */}
            <polygon points="36,5 57,27 49,67 23,67 15,27" fill="url(#mfg)" stroke="rgba(167,139,250,0.45)" strokeWidth="0.8">
                <animateTransform attributeName="transform" type="rotate" from="0 36 36" to="360 36 36" dur="16s" repeatCount="indefinite" />
            </polygon>
            <line x1="36" y1="5"  x2="36" y2="67" stroke="rgba(167,139,250,0.15)" strokeWidth="0.6" />
            <line x1="15" y1="27" x2="57" y2="27" stroke="rgba(76,201,240,0.12)"  strokeWidth="0.5" />
            <ellipse cx="28" cy="17" rx="6" ry="3.5" fill="rgba(255,255,255,0.5)" filter="url(#mfbl)" />
        </svg>
    );
}

// ─── Reveal x1 ───────────────────────────────────────────────

function RevealSingle({ result, onBack }: { result: PullResult; onBack: () => void }) {
    const [showBurst, setShowBurst] = useState(true);
    const [showBinder, setShowBinder] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const rs = RS[result.rarity];
    const slug = toSlug(result.name);

    useEffect(() => {
        const rank = ["COMMON","RARE","EPIC","ELITE","LEGENDARY","MYTHIC"].indexOf(result.rarity);
        if (rank < 3) return;
        const start = setTimeout(() => {
            const iv = setInterval(() => { if (containerRef.current) cssParticles(containerRef.current, rs.p, 8); }, 900);
            return () => clearInterval(iv);
        }, 800);
        return () => clearTimeout(start);
    }, [result.rarity]);

    return (
        <div ref={containerRef} style={{
            position: "fixed", inset: 0, zIndex: 200,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            fontFamily: "'Exo 2',sans-serif", overflow: "hidden",
            background: showBinder
                ? `radial-gradient(ellipse at 50% 42%,${rs.bgR} 0%,rgba(7,11,20,0.97) 58%),#070b14`
                : "#070b14",
            transition: "background 0.6s ease",
        }}>
            {/* Fondo animado reveal */}
            {showBinder && (
                <>
                    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 80%, rgba(123,47,255,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(76,201,240,0.05) 0%, transparent 50%)", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(123,47,255,0.04) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none", opacity: 0.6 }} />
                </>
            )}

            {/* Botón izquierda */}
            {showBinder && (
                <button onClick={onBack} style={{ position: "absolute", left: "clamp(12px,3vw,32px)", top: "50%", transform: "translateY(-50%)", padding: "10px 18px", borderRadius: 8, fontSize: "var(--font-xs)", fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.2)", color: "#e2e8f0", zIndex: 20, animation: "nxSlideUp 0.35s 0.92s ease both", opacity: 0 }}>← Back</button>
            )}
            {/* Botón derecha */}
            {showBinder && (
                <button onClick={onBack} style={{ position: "absolute", right: "clamp(12px,3vw,32px)", top: "50%", transform: "translateY(-50%)", padding: "10px 20px", borderRadius: 8, fontSize: "var(--font-xs)", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em", background: rs.bg, border: `1px solid ${rs.border}`, color: rs.color, boxShadow: `0 0 14px ${rs.glow.replace(/[\d.]+\)$/, "0.35)")}`, zIndex: 20, animation: "nxSlideUp 0.35s 0.95s ease both", opacity: 0 }}>Close ✓</button>
            )}

            {/* Three.js burst */}
            {showBurst && <FullScreenBurst color={rs.hex} onDone={() => { setShowBurst(false); setShowBinder(true); }} />}

            {/* Binder */}
            {showBinder && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "clamp(8px,2vh,14px)", width: "100%", maxWidth: "clamp(300px,50vw,520px)", padding: "0 clamp(16px,4vw,32px)", position: "relative", zIndex: 10 }}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ position: "absolute", inset: -50, borderRadius: "50%", background: `radial-gradient(circle,${rs.bgR} 0%,transparent 65%)`, animation: "nxGlow 2s ease-in-out infinite" }} />
                        <img src={mythFrontUrl(result.speciesId, slug)} alt={result.name}
                            style={{ width: "clamp(110px,22vw,200px)", height: "clamp(130px,26vw,240px)", objectFit: "contain", position: "relative", zIndex: 1, filter: `drop-shadow(0 0 28px ${rs.glow}) drop-shadow(0 0 60px ${rs.glow.replace(/[\d.]+\)$/, "0.35)")})`, animation: "nxBinder 0.85s cubic-bezier(0.34,1.56,0.64,1) both" }}
                            onError={(e) => { const t = e.target as HTMLImageElement; t.style.display="none"; if(t.parentElement){t.parentElement.style.fontSize="80px";t.parentElement.innerHTML="🔮";} }}
                        />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(5px,1.2vh,9px)", animation: "nxSlideUp 0.5s 0.3s ease both", opacity: 0 }}>
                        <div style={{ padding: "4px 18px", borderRadius: 4, fontSize: "var(--font-xs)", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", background: rs.bg, border: `1px solid ${rs.border}`, color: rs.color, boxShadow: `0 0 14px ${rs.glow.replace(/[\d.]+\)$/, "0.45)")}` }}>
                            ★ {rs.label}{result.isPityGuarantee ? " · ✨" : ""}
                        </div>
                        <p style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: "clamp(28px,5vw,46px)", color: rs.color, lineHeight: 1, textShadow: `0 0 24px ${rs.glow}`, animation: "nxNameRev 0.55s 0.5s ease both", opacity: 0 }}>{result.name}</p>
                        <div style={{ display: "flex", gap: 6, animation: "nxSlideUp 0.38s 0.65s ease both", opacity: 0 }}>
                            {result.affinities.map(a => <img key={a} src={affinityUrl(a)} alt={a} style={{ width: 22, height: 22, objectFit: "contain", filter: "drop-shadow(0 0 4px rgba(255,255,255,0.35))" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />)}
                        </div>
                        <div style={{ display: "flex", gap: 7, animation: "nxSlideUp 0.38s 0.78s ease both", opacity: 0 }}>
                            {[["HP", result.maxHp], ["ATK", result.attack], ["DEF", result.defense], ["SPD", result.speed]].map(([k, v]) => (
                                <div key={k as string} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${rs.border}44`, borderRadius: 6, padding: "5px 10px", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 44 }}>
                                    <span style={{ fontSize: "var(--font-2xs)", color: "#e2e8f0", textTransform: "uppercase" }}>{k}</span>
                                    <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "#ffffff" }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Reveal x5 ───────────────────────────────────────────────

type CrystalState = "idle" | "cracking" | "revealed";

function RevealMulti({ results, onBack }: { results: PullResult[]; onBack: () => void }) {
    const [states, setStates] = useState<CrystalState[]>(Array(5).fill("idle"));
    const [burstInfo, setBurstInfo] = useState<{ color: number; x: number; y: number; key: number } | null>(null);
    const [done, setDone] = useState(false);
    const wrapRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        let cancelled = false;
        async function run() {
            await loadThree();
            for (let i = 0; i < 5; i++) {
                if (cancelled) return;
                await new Promise(r => setTimeout(r, 1000));
                if (cancelled) return;
                setStates(p => { const n = [...p]; n[i] = "cracking"; return n; });

                // Obtener posición real del cristal para el burst
                const ref = wrapRefs.current[i];
                let bx = window.innerWidth / 2, by = window.innerHeight / 2;
                if (ref) {
                    const rect = ref.getBoundingClientRect();
                    bx = rect.left + rect.width / 2;
                    by = rect.top + rect.height / 2;
                    cssParticles(ref, RS[results[i].rarity].p, 24);
                }
                setBurstInfo({ color: RS[results[i].rarity].hex, x: bx, y: by, key: i });

                await new Promise(r => setTimeout(r, 700));
                if (cancelled) return;
                setStates(p => { const n = [...p]; n[i] = "revealed"; return n; });
                await new Promise(r => setTimeout(r, 380));
            }
            await new Promise(r => setTimeout(r, 1100));
            if (!cancelled) setDone(true);
        }
        run();
        return () => { cancelled = true; };
    }, []);

    if (done) {
        return (
            <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Exo 2',sans-serif", overflow: "hidden" }}>
                {/* Fondo bonito del resumen */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(123,47,255,0.12) 0%,rgba(7,11,20,0.98) 40%,rgba(76,201,240,0.08) 100%)", zIndex: 0 }} />
                <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(123,47,255,0.05) 1px, transparent 1px)", backgroundSize: "28px 28px", zIndex: 0 }} />
                <p style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: "var(--font-xl)", color: "#ffffff", letterSpacing: "0.14em", marginBottom: 28, position: "relative", zIndex: 1 }}>SUMMONS</p>
                <div style={{ display: "flex", gap: "clamp(10px,2vw,20px)", justifyContent: "center", flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                    {results.map((r, i) => {
                        const rs2 = RS[r.rarity];
                        return (
                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, background: rs2.bg, border: `2px solid ${rs2.border}`, borderRadius: 12, padding: "clamp(10px,2vw,16px) clamp(12px,2.5vw,20px)", minWidth: "clamp(82px,10vw,112px)", boxShadow: `0 0 22px ${rs2.glow.replace(/[\d.]+\)$/, "0.32)")}`, animation: `nxSlideUp 0.35s ${i * 0.09}s ease both`, opacity: 0 }}>
                                <img src={mythFrontUrl(r.speciesId, toSlug(r.name))} alt={r.name} style={{ width: "clamp(52px,7vw,72px)", height: "clamp(65px,9vw,90px)", objectFit: "contain", filter: `drop-shadow(0 0 10px ${rs2.glow})` }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                <span style={{ fontSize: "var(--font-xs)", color: rs2.color, fontWeight: 700, textAlign: "center" }}>{r.name}</span>
                                <span style={{ fontSize: "var(--font-2xs)", color: rs2.border, letterSpacing: "0.06em", textTransform: "uppercase" }}>{rs2.label}</span>
                                {r.isPityGuarantee && <span style={{ fontSize: 9, color: "#fbbf24" }}>✨</span>}
                            </div>
                        );
                    })}
                </div>
                <button onClick={onBack} style={{ marginTop: 32, padding: "11px 36px", borderRadius: 9, fontSize: "var(--font-sm)", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em", background: "rgba(123,47,255,0.25)", border: "1px solid rgba(123,47,255,0.6)", color: "#c4b5fd", position: "relative", zIndex: 1 }}>
                    ← Back to Nexus
                </button>
            </div>
        );
    }

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "clamp(24px,5vh,48px)", overflow: "hidden", fontFamily: "'Exo 2',sans-serif" }}>
            {/* Fondo bonito opening */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(123,47,255,0.1) 0%, rgba(7,11,20,0.98) 65%)", zIndex: 0 }} />
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(123,47,255,0.04) 1px, transparent 1px), radial-gradient(rgba(76,201,240,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px, 20px 20px", zIndex: 0 }} />

            {/* Burst posicionado en el cristal */}
            {burstInfo && <FullScreenBurst key={burstInfo.key} color={burstInfo.color} x={burstInfo.x} y={burstInfo.y} onDone={() => setBurstInfo(null)} />}

            <p style={{ fontSize: "var(--font-sm)", color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 700, animation: "nxPulse 1.5s ease-in-out infinite", position: "relative", zIndex: 1 }}>Opening essences...</p>

            <div style={{ display: "flex", gap: "clamp(28px,5vw,64px)", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
                {results.map((r, i) => {
                    const rs2 = RS[r.rarity]; const state = states[i]; const slug = toSlug(r.name);
                    return (
                        <div key={i} ref={el => { wrapRefs.current[i] = el; }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, position: "relative" }}>
                            {state !== "revealed" ? (
                                <div style={{ animation: state === "cracking" ? "nxExplode 0.5s ease-in forwards" : undefined }}>
                                    <MiniFragment dim={state === "idle"} />
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, animation: "nxSlideUp 0.42s ease both" }}>
                                    <div style={{ position: "relative" }}>
                                        <div style={{ position: "absolute", inset: "-22px", borderRadius: "50%", background: `radial-gradient(circle, ${rs2.bgR} 0%, transparent 72%)`, animation: "nxGlow 2s ease-in-out infinite", pointerEvents: "none" }} />
                                        <img src={mythFrontUrl(r.speciesId, slug)} alt={r.name}
                                            style={{ width: "clamp(70px,9.5vw,100px)", height: "clamp(88px,12vw,125px)", objectFit: "contain", position: "relative", zIndex: 1, filter: `drop-shadow(0 0 14px ${rs2.glow}) drop-shadow(0 0 28px ${rs2.glow.replace(/[\d.]+\)$/, "0.4)")})` }}
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                    </div>
                                    <div style={{ padding: "2px 10px", borderRadius: 3, fontSize: "var(--font-2xs)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", background: rs2.bg, border: `1px solid ${rs2.border}`, color: rs2.color, boxShadow: `0 0 10px ${rs2.glow.replace(/[\d.]+\)$/, "0.4)")}` }}>{rs2.label}</div>
                                    <span style={{ fontSize: "var(--font-xs)", color: rs2.color, fontWeight: 700, textAlign: "center", maxWidth: 100 }}>{r.name}</span>
                                    {r.isPityGuarantee && <span style={{ fontSize: 9, color: "#fbbf24" }}>✨</span>}
                                </div>
                            )}
                            <span style={{ fontSize: "var(--font-2xs)", color: state === "revealed" ? rs2.border : "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>{i + 1}</span>
                        </div>
                    );
                })}
            </div>
            <button onClick={onBack} style={{ position: "absolute", bottom: 20, left: 20, padding: "8px 18px", borderRadius: 7, fontSize: "var(--font-xs)", fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)", color: "#e2e8f0", zIndex: 1 }}>← Back</button>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────

export default function NexusPage() {
    const navigate = useNavigate();
    const [banner, setBanner]   = useState<Banner | null>(null);
    const [pity, setPity]       = useState<PityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [pulling, setPulling] = useState(false);
    const [error, setError]     = useState<string | null>(null);
    const [singleResult, setSingleResult] = useState<PullResult | null>(null);
    const [multiResults, setMultiResults] = useState<PullResult[] | null>(null);

    const [sphereSize, setSphereSize] = useState(170);
    useEffect(() => {
        function onResize() {
            const w = window.innerWidth;
            setSphereSize(w < 700 ? 160 : w < 1100 ? 210 : 280);
        }
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const [br, pr] = await Promise.all([api.nexusBanner(), api.nexusPity()]);
            setBanner((br as any).banner); setPity(pr as any);
        } catch { setError("Failed to load Nexus"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); loadThree(); }, [fetchData]);

    async function handlePull(amount: 1 | 5) {
        if (!pity || pity.essences < amount || pulling) return;
        setPulling(true); setError(null);
        try {
            const res: any = await api.nexusPull(amount);
            await fetchData();
            if (amount === 1) setSingleResult(res.results[0]);
            else setMultiResults(res.results);
        } catch (e: any) { setError(e.message ?? "Pull failed"); }
        finally { setPulling(false); }
    }

    const essences = pity?.essences ?? 0;
    const boostedId = banner?.boostedMythIds?.[0] ?? null;
    const boostedSlug = boostedId ? toSlug(boostedId) : null;
    // Nombre del boosted: usar el ID directamente (speciesId es el nombre en tu sistema)
    const boostedName = boostedId ?? null;

    return (
        <PageShell ambientColor="rgba(123,47,255,0.07)">
            <style>{`
                @keyframes nxGlow     { 0%,100%{opacity:0.5;transform:scale(0.9)} 50%{opacity:0.18;transform:scale(1.1)} }
                @keyframes nxFloat    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
                @keyframes nxMaura    { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
                @keyframes nxX10      { 0%,100%{box-shadow:0 0 4px rgba(251,191,36,0.3)} 50%{box-shadow:0 0 14px rgba(251,191,36,0.8)} }
                @keyframes nxSparkle  { 0%,100%{opacity:0;transform:scale(0)} 40%,60%{opacity:1;transform:scale(1)} }
                @keyframes nxSlideUp  { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
                @keyframes nxNameRev  { from{letter-spacing:0.55em;opacity:0} to{letter-spacing:0.02em;opacity:1} }
                @keyframes nxExplode  { 0%{transform:scale(1);opacity:1;filter:blur(0)} 50%{transform:scale(2.1);opacity:0.35;filter:blur(4px)} 100%{transform:scale(0.04);opacity:0;filter:blur(8px)} }
                @keyframes nxPulse    { 0%,100%{opacity:0.55} 50%{opacity:1} }
                @keyframes nxPart     { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0} }
                @keyframes nxBinder   { from{transform:scale(0.08) translateY(70px);opacity:0;filter:blur(10px)} 60%{filter:blur(0)} to{transform:scale(1) translateY(0);opacity:1} }
                /* 4 variantes de float para las partículas del fragmento */
                @keyframes nxFragFloat0 { 0%,100%{transform:translateY(0px) translateX(0px);opacity:0.9} 50%{transform:translateY(-4px) translateX(1px);opacity:1} }
                @keyframes nxFragFloat1 { 0%,100%{transform:translateY(0px) translateX(0px);opacity:0.8} 50%{transform:translateY(3px) translateX(-2px);opacity:1} }
                @keyframes nxFragFloat2 { 0%,100%{transform:translateY(0px) translateX(0px);opacity:0.85} 33%{transform:translateY(-3px) translateX(2px);opacity:1} 66%{transform:translateY(2px) translateX(-1px);opacity:0.9} }
                @keyframes nxFragFloat3 { 0%,100%{transform:translateY(0px);opacity:0.7} 50%{transform:translateY(-5px);opacity:1} }
            `}</style>

            <PageTopbar title="Nexus" onBack={() => navigate(-1)} />

            <div className="relative flex-1 flex overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p style={{ color: "#e2e8f0", fontSize: "var(--font-sm)" }}>Loading...</p>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
                        {/* Fondo bonito de la página principal */}
                        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(123,47,255,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(76,201,240,0.04) 0%, transparent 45%)", pointerEvents: "none", zIndex: 0 }} />
                        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(123,47,255,0.035) 1px, transparent 1px)", backgroundSize: "36px 36px", pointerEvents: "none", zIndex: 0 }} />

                        {/* LEFT: 220px */}
                        <div style={{ width: 220, minWidth: 220, borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1 }}>
                            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,rgba(251,191,36,0.22) 0%,rgba(180,83,9,0.3) 45%,rgba(7,11,20,0.95) 100%)" }} />
                                {boostedId && boostedSlug ? (
                                    <img src={mythFrontUrl(boostedId, boostedSlug)} alt="Boosted"
                                        style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center 10%", opacity: 0.9, display: "block", position: "relative", zIndex: 1, padding: "8px 8px 90px" }}
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                ) : (
                                    <div style={{ width: "100%", height: "calc(100% - 90px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, position: "relative", zIndex: 1 }}>🐉</div>
                                )}
                                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(7,11,20,1) 0%,rgba(7,11,20,0.35) 38%,transparent 65%)", zIndex: 2 }} />
                                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 28%,rgba(251,191,36,0.2) 0%,transparent 58%)", animation: "nxMaura 2.5s ease-in-out infinite", zIndex: 2, pointerEvents: "none" }} />
                                {SPARKLES.map((s, i) => (
                                    <div key={i} style={{ position: "absolute", zIndex: 3, pointerEvents: "none", color: "#fbbf24", fontSize: s.fs, top: s.top, left: s.left, animation: `nxSparkle 2.2s ease-in-out ${s.delay} infinite` }}>✦</div>
                                ))}
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 10px", zIndex: 4 }}>
                                    <span style={{ fontSize: "var(--font-2xs)", textTransform: "uppercase", letterSpacing: "0.12em", color: "#fbbf24", fontWeight: 700, display: "block", marginBottom: 4, textShadow: "0 0 8px rgba(251,191,36,0.6)" }}>✦ Featured this week</span>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(251,191,36,0.22)", border: "1px solid rgba(251,191,36,0.65)", borderRadius: 3, fontSize: "var(--font-2xs)", fontWeight: 700, color: "#fbbf24", padding: "2px 6px", marginBottom: 5, animation: "nxX10 1.5s ease-in-out infinite" }}>★ ×10 BOOST</div>
                                    <div style={{ fontSize: "var(--font-md)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: "#ffffff", textShadow: "0 0 14px rgba(251,191,36,0.7),0 2px 4px rgba(0,0,0,0.8)", lineHeight: 1, marginBottom: 2 }}>
                                        {boostedName ?? "No active banner"}
                                    </div>
                                    {boostedName && <div style={{ fontSize: "var(--font-2xs)", color: "#fcd34d" }}>Legendary</div>}
                                </div>
                            </div>
                            {/* Pity */}
                            <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.25)" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                    <span style={{ fontSize: "var(--font-2xs)", textTransform: "uppercase", letterSpacing: "0.1em", color: "#ffffff", fontWeight: 700 }}>Pity Tracker</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(123,47,255,0.18)", border: "1px solid rgba(123,47,255,0.45)", borderRadius: 5, padding: "2px 8px", fontSize: "var(--font-sm)", fontWeight: 700, color: "#c4b5fd" }}>
                                        🔮 {essences}
                                    </div>
                                </div>
                                {PITY_KEYS.map(({ key, label, color, max }) => {
                                    const cur = (pity as any)?.[key] ?? 0;
                                    const pct = Math.min((cur / max) * 100, 100);
                                    const hot = pct >= 70;
                                    return (
                                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                            <span style={{ fontSize: "var(--font-xs)", color: hot ? color : "#e2e8f0", minWidth: 54, fontWeight: hot ? 700 : 400 }}>{label}</span>
                                            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                                                <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2, background: color, transition: "width 0.4s ease", boxShadow: hot ? `0 0 6px ${color}` : "none" }} />
                                            </div>
                                            <span style={{ fontSize: "var(--font-2xs)", color: "#e2e8f0", fontFamily: "monospace", minWidth: 38, textAlign: "right" }}>{cur}/{max}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* CENTER: Fragmento + botones */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "clamp(10px,2vh,18px)", position: "relative", zIndex: 1 }}>
                            <div style={{ animation: "nxFloat 3.2s ease-in-out infinite", position: "relative", zIndex: 1 }}>
                                <EssenceFragment size={sphereSize} />
                            </div>
                            <div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
                                <p style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "#ffffff", letterSpacing: "0.1em", textTransform: "uppercase" }}>Essence</p>
                                <p style={{ fontSize: "var(--font-xs)", color: "#67e8f9", marginTop: 2 }}>
                                    {banner ? `Boost active · ×10` : "No active banner"}
                                </p>
                            </div>
                            {error && <p style={{ fontSize: "var(--font-xs)", color: "#f87171", textAlign: "center", maxWidth: 180, position: "relative", zIndex: 2 }}>{error}</p>}
                            <div style={{ display: "flex", gap: 10, position: "relative", zIndex: 10 }}>
                                {([1, 5] as const).map(n => (
                                    <button key={n} onClick={() => handlePull(n)} disabled={pulling || essences < n} style={{
                                        padding: "11px clamp(20px,3vw,32px)", borderRadius: 8,
                                        fontSize: "var(--font-sm)", fontWeight: 700, letterSpacing: "0.05em",
                                        cursor: essences >= n && !pulling ? "pointer" : "not-allowed",
                                        border: `1px solid ${essences >= n ? (n === 5 ? "rgba(123,47,255,0.75)" : "rgba(123,47,255,0.55)") : "rgba(255,255,255,0.1)"}`,
                                        background: essences >= n ? (n === 5 ? "rgba(123,47,255,0.32)" : "rgba(123,47,255,0.18)") : "rgba(255,255,255,0.03)",
                                        color: essences >= n ? (n === 5 ? "#e2d9ff" : "#c4b5fd") : "#e2e8f0",
                                        transition: "all 0.15s", position: "relative", zIndex: 10,
                                        boxShadow: essences >= n ? `0 0 14px ${n === 5 ? "rgba(123,47,255,0.4)" : "rgba(123,47,255,0.22)"}` : "none",
                                    }}>
                                        {pulling ? "..." : `Open ×${n}`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: 148px */}
                        <div style={{ width: 148, minWidth: 148, borderLeft: "1px solid rgba(255,255,255,0.07)", padding: "12px 13px", display: "flex", flexDirection: "column", gap: 5, position: "relative", zIndex: 1 }}>
                            <p style={{ fontSize: "var(--font-xs)", textTransform: "uppercase", letterSpacing: "0.12em", color: "#ffffff", fontWeight: 700, marginBottom: 3 }}>Rates</p>
                            {([
                                { l: "Common",    c: "#64748b", tc: "#e2e8f0", r: "60%" },
                                { l: "Rare",      c: "#6366f1", tc: "#c7d2fe", r: "30%" },
                                { l: "Epic",      c: "#a855f7", tc: "#e9d5ff", r: "7%"  },
                                { l: "Elite",     c: "#94a3b8", tc: "#f1f5f9", r: "2.5%" },
                                { l: "Legendary", c: "#fbbf24", tc: "#fde68a", r: "0.5%" },
                            ] as const).map(({ l, c, tc, r }) => (
                                <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", gap: 4 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                        <div style={{ width: 7, height: 7, borderRadius: 1, background: c, flexShrink: 0 }} />
                                        <span style={{ fontSize: "var(--font-xs)", color: tc }}>{l}</span>
                                    </div>
                                    <span style={{ fontSize: "var(--font-xs)", fontFamily: "monospace", color: "#e2e8f0", flexShrink: 0 }}>{r}</span>
                                </div>
                            ))}
                            <div style={{ marginTop: 6, paddingTop: 7, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                                <p style={{ fontSize: "var(--font-xs)", color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 }}>Boost ×10</p>
                                <p style={{ fontSize: "var(--font-2xs)", color: "#e2e8f0", lineHeight: 1.55 }}>If you get the featured myth's rarity, ×10 chance it's them.</p>
                            </div>
                            {banner && (
                                <div style={{ marginTop: 6, paddingTop: 7, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                                    <p style={{ fontSize: "var(--font-2xs)", color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 3 }}>Changes in</p>
                                    <p style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "#a78bfa", fontFamily: "monospace" }}>{daysLeft(banner.endsAt)}d</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {singleResult && <RevealSingle result={singleResult} onBack={() => setSingleResult(null)} />}
            {multiResults && <RevealMulti results={multiResults} onBack={() => setMultiResults(null)} />}
        </PageShell>
    );
}
