// apps/client/src/pages/MarketPage.tsx
import { useState } from "react";
import { useTrainer } from "../context/TrainerContext";
import PageShell from "../components/PageShell";
import PageTopbar from "../components/PageTopbar";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "offers" | "gold" | "diamonds";

interface GoldItem {
  id: string; name: string; description: string; icon: string;
  price: number; category: string; badge?: string; badgeColor?: string;
}
interface DiamondBundle {
  id: string; diamonds: number; bonus: number; price: string;
  popular?: boolean; best?: boolean; color: string;
}
interface OfferItem {
  id: string; name: string; description: string; icon: string;
  original: number; discounted: number; currency: "gold" | "diamonds";
  discount: number; endsIn: string; color: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const GOLD_ITEMS: GoldItem[] = [
  { id:"elixir",       name:"Elixir",       description:"Restore 30% HP to one Myth.",          icon:"🧪", price:150,   category:"Elixirs" },
  { id:"mega_elixir",  name:"Mega Elixir",  description:"Restore 60% HP to one Myth.",          icon:"🧪", price:400,   category:"Elixirs", badge:"×2 HP", badgeColor:"#34d399" },
  { id:"grand_elixir", name:"Grand Elixir", description:"Fully restore HP to one Myth.",        icon:"🧪", price:900,   category:"Elixirs", badge:"FULL",  badgeColor:"#67e8f9" },
  { id:"spark",        name:"Spark",        description:"Revive a fainted Myth with 50% HP.",   icon:"💊", price:600,   category:"Elixirs" },
  { id:"grand_spark",  name:"Grand Spark",  description:"Revive with full HP.",                 icon:"✨", price:1500,  category:"Elixirs", badge:"BEST",  badgeColor:"#fbbf24" },
  { id:"ember_shard",  name:"Ember Shard",  description:"Evolution material — Ember Myths.",    icon:"🔥", price:800,   category:"Shards" },
  { id:"tide_shard",   name:"Tide Shard",   description:"Evolution material — Tide Myths.",     icon:"💧", price:800,   category:"Shards" },
  { id:"volt_shard",   name:"Volt Shard",   description:"Evolution material — Volt Myths.",     icon:"⚡", price:800,   category:"Shards" },
  { id:"grove_shard",  name:"Grove Shard",  description:"Evolution material — Grove Myths.",    icon:"🌿", price:800,   category:"Shards" },
  { id:"frost_shard",  name:"Frost Shard",  description:"Evolution material — Frost Myths.",    icon:"❄️", price:800,   category:"Shards" },
  { id:"bond_crystal", name:"Bond Crystal", description:"Increases bond level with your Myth.", icon:"🔗", price:2000,  category:"Materials" },
  { id:"astral_scale", name:"Astral Scale", description:"Rare ascension material.",             icon:"🐉", price:5000,  category:"Materials", badge:"RARE", badgeColor:"#a78bfa" },
  { id:"iron_coat",    name:"Iron Coat",    description:"Boosts defense stat temporarily.",     icon:"⚙️", price:1200,  category:"Materials" },
  { id:"cipher_core",  name:"Cipher Core",  description:"Unlocks secret Myth potential.",       icon:"⬆️", price:8000,  category:"Materials", badge:"EPIC", badgeColor:"#7b2fff" },
];

const DIAMOND_BUNDLES: DiamondBundle[] = [
  { id:"starter",   diamonds:80,   bonus:0,    price:"0.99€",  color:"#64748b" },
  { id:"small",     diamonds:330,  bonus:30,   price:"4.99€",  color:"#6366f1" },
  { id:"medium",    diamonds:700,  bonus:100,  price:"9.99€",  color:"#a78bfa", popular:true },
  { id:"large",     diamonds:1500, bonus:300,  price:"19.99€", color:"#fbbf24" },
  { id:"mega",      diamonds:3200, bonus:800,  price:"39.99€", color:"#fb923c", best:true },
  { id:"legendary", diamonds:6800, bonus:2000, price:"79.99€", color:"#f87171" },
];

const OFFERS: OfferItem[] = [
  { id:"offer1", name:"Starter Bundle",  description:"5× Elixir + 3× Spark + 500 Gold",      icon:"🎁", original:1200,  discounted:600,  currency:"gold",     discount:50, endsIn:"23h 14m", color:"#34d399" },
  { id:"offer2", name:"Shard Pack",      description:"2× of each elemental shard (10 total)", icon:"💠", original:8000,  discounted:4000, currency:"gold",     discount:50, endsIn:"2d 6h",   color:"#67e8f9" },
  { id:"offer3", name:"Ascension Kit",   description:"1× Astral Scale + 2× Bond Crystal",    icon:"🌟", original:700,   discounted:350,  currency:"diamonds", discount:50, endsIn:"11h 52m", color:"#fbbf24" },
  { id:"offer4", name:"Weekend Warrior", description:"10× Grand Elixir + 5× Grand Spark",    icon:"⚔️", original:16500, discounted:8250, currency:"gold",     discount:50, endsIn:"1d 18h",  color:"#f87171" },
  { id:"offer5", name:"Diamond Rush",    description:"650 💎 + 3× Cipher Core",              icon:"💎", original:1999,  discounted:999,  currency:"diamonds", discount:50, endsIn:"6h 30m",  color:"#a78bfa" },
];

// ─── Card rail — horizontal scroll container ──────────────────────────────────
function CardRail({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex-1 flex items-stretch gap-3 px-4 overflow-x-auto"
      style={{ scrollbarWidth:"none", WebkitOverflowScrolling:"touch", alignSelf:"stretch" } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

// ─── Offer card ───────────────────────────────────────────────────────────────
function OfferCard({ offer, gold, diamonds }: { offer: OfferItem; gold: number; diamonds: number }) {
  const balance   = offer.currency === "gold" ? gold : diamonds;
  const canAfford = balance >= offer.discounted;
  const cIcon     = offer.currency === "gold" ? "🪙" : "💎";
  const cColor    = offer.currency === "gold" ? "var(--accent-gold)" : "#c4b5fd";
  const darkText  = ["#34d399","#67e8f9","#fbbf24"].includes(offer.color);

  return (
    <div
      className="flex-shrink-0 flex flex-col rounded-2xl relative"
      style={{
        width:"clamp(180px,25vw,240px)",
        background:`linear-gradient(160deg,${offer.color}14,rgba(7,11,20,0.95))`,
        border:`1px solid ${offer.color}30`,
      }}
    >
      {/* Discount badge — barra superior dentro del card */}
      <div
        className="flex-shrink-0 flex items-center justify-end px-3 py-1.5 font-black rounded-t-2xl"
        style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:"var(--font-xs)", background:`${offer.color}22`, borderBottom:`1px solid ${offer.color}30`, color:offer.color, letterSpacing:".08em" }}
      >
        -{offer.discount}% OFF
      </div>

      {/* Icon area */}
      <div
        className="flex items-center justify-center flex-shrink-0 rounded-t-2xl"
        style={{ height:"clamp(90px,18vh,130px)", background:`${offer.color}0d`, borderBottom:`1px solid ${offer.color}18` }}
      >
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{ width:46,height:46,fontSize:22,background:`${offer.color}18`,border:`1px solid ${offer.color}35` }}
        >
          {offer.icon}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div>
          <div className="font-black leading-tight" style={{ fontFamily:"'Rajdhani',sans-serif",fontSize:"var(--font-md)",color:"var(--text-primary)" }}>
            {offer.name}
          </div>
          <div style={{ fontSize:"var(--font-xs)",color:"var(--text-muted)",lineHeight:1.4,marginTop:2 }}>
            {offer.description}
          </div>
        </div>

        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md self-start"
          style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",fontSize:"var(--font-xs)",color:"var(--text-muted)",fontFamily:"monospace" }}
        >
          ⏱ {offer.endsIn}
        </div>

        {/* Price + buy */}
        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span style={{ fontSize:"var(--font-xs)",color:"var(--text-disabled)",textDecoration:"line-through",fontFamily:"monospace" }}>
              {cIcon} {offer.original.toLocaleString()}
            </span>
            <span className="font-black" style={{ fontFamily:"'Rajdhani',sans-serif",fontSize:"var(--font-lg)",color:cColor }}>
              {cIcon} {offer.discounted.toLocaleString()}
            </span>
          </div>
          <button
            className="w-full py-2 rounded-xl font-black tracking-widest uppercase transition-all hover:brightness-110 active:scale-95"
            style={{
              fontFamily:"'Rajdhani',sans-serif",fontSize:"var(--font-xs)",
              background:canAfford?`linear-gradient(135deg,${offer.color},${offer.color}99)`:"rgba(255,255,255,0.04)",
              color:canAfford?(darkText?"#070b14":"#fff"):"var(--text-disabled)",
              border:canAfford?"none":"1px solid rgba(255,255,255,0.08)",
              cursor:canAfford?"pointer":"not-allowed",
              boxShadow:canAfford?`0 4px 12px ${offer.color}30`:"none",
            }}
          >
            Buy now
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Gold card ────────────────────────────────────────────────────────────────
function GoldCard({ item, gold }: { item: GoldItem; gold: number }) {
  const canAfford = gold >= item.price;
  return (
    <div
      className="flex-shrink-0 flex flex-col rounded-2xl relative transition-all hover:scale-[1.02]"
      style={{ width:"clamp(155px,20vw,210px)",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)" }}
    >
      {item.badge && (
        <div
          className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md font-mono font-bold"
          style={{ fontSize:"var(--font-xs)",background:`${item.badgeColor}22`,color:item.badgeColor,border:`1px solid ${item.badgeColor}40` }}
        >
          {item.badge}
        </div>
      )}
      <div className="flex items-center justify-center flex-shrink-0" style={{ height:"clamp(80px,15vh,110px)",fontSize:36 }}>
        {item.icon}
      </div>
      <div className="flex flex-col flex-1 px-3 pb-3 gap-2">
        <div>
          <div className="font-black" style={{ fontFamily:"'Rajdhani',sans-serif",fontSize:"var(--font-base)",color:"var(--text-primary)" }}>
            {item.name}
          </div>
          <div style={{ fontSize:"var(--font-xs)",color:"var(--text-muted)",lineHeight:1.4,marginTop:2 }}>
            {item.description}
          </div>
        </div>
        <button
          className="mt-auto w-full py-1.5 rounded-xl font-black tracking-widest uppercase transition-all hover:brightness-110 active:scale-95"
          style={{
            fontFamily:"'Rajdhani',sans-serif",fontSize:"var(--font-xs)",
            background:canAfford?"linear-gradient(135deg,rgba(251,191,36,0.2),rgba(249,115,22,0.2))":"rgba(255,255,255,0.04)",
            color:canAfford?"var(--accent-gold)":"var(--text-disabled)",
            border:canAfford?"1px solid rgba(251,191,36,0.35)":"1px solid rgba(255,255,255,0.08)",
            cursor:canAfford?"pointer":"not-allowed",
          }}
        >
          🪙 {item.price.toLocaleString()}
        </button>
      </div>
    </div>
  );
}

// ─── Diamond card ─────────────────────────────────────────────────────────────
function DiamondCard({ bundle }: { bundle: DiamondBundle }) {
  const darkText = ["#fbbf24","#34d399","#67e8f9"].includes(bundle.color);
  return (
    <div
      className="flex-shrink-0 flex flex-col rounded-2xl relative transition-all hover:scale-[1.03] overflow-hidden"
      style={{
        width:"clamp(155px,20vw,210px)",
        background:`linear-gradient(160deg,${bundle.color}14,rgba(7,11,20,0.95))`,
        border:`1px solid ${bundle.color}35`,
        boxShadow:bundle.popular||bundle.best?`0 0 24px ${bundle.color}20`:"none",
      }}
    >
      {/* Badge — barra superior dentro del card, sin overflow */}
      {(bundle.popular || bundle.best) && (
        <div
          className="flex-shrink-0 flex items-center justify-center py-1.5 font-black tracking-widest uppercase"
          style={{
            fontFamily:"'Rajdhani',sans-serif",
            fontSize:"var(--font-xs)",
            background:bundle.color,
            color:darkText?"#070b14":"#fff",
            letterSpacing:".1em",
          }}
        >
          {bundle.popular ? "⭐ POPULAR" : "🏆 BEST VALUE"}
        </div>
      )}

      {/* Icon + amount */}
      <div
        className="flex flex-col items-center justify-center flex-1 gap-2"
        style={{ padding:"16px 12px 8px" }}
      >
        <div style={{ fontSize:36 }}>💎</div>
        <div className="font-black" style={{ fontFamily:"'Rajdhani',sans-serif",fontSize:"var(--font-3xl)",color:bundle.color,lineHeight:1 }}>
          {(bundle.diamonds + bundle.bonus).toLocaleString()}
        </div>
        {bundle.bonus > 0 && (
          <div style={{ fontSize:"var(--font-xs)",color:"var(--text-muted)",fontFamily:"monospace",textAlign:"center" }}>
            {bundle.diamonds.toLocaleString()} <span style={{ color:"#34d399" }}>+{bundle.bonus} bonus</span>
          </div>
        )}
      </div>

      {/* Price button */}
      <div className="px-3 pb-4">
        <button
          className="w-full py-2.5 rounded-xl font-black tracking-widest uppercase transition-all hover:brightness-110 active:scale-95"
          style={{
            fontFamily:"'Rajdhani',sans-serif",fontSize:"var(--font-base)",
            background:`linear-gradient(135deg,${bundle.color},${bundle.color}99)`,
            color:darkText?"#070b14":"#fff",border:"none",
            boxShadow:`0 4px 14px ${bundle.color}35`,cursor:"pointer",
          }}
        >
          {bundle.price}
        </button>
      </div>
    </div>
  );
}

// ─── Tab contents ─────────────────────────────────────────────────────────────
function OffersContent({ gold, diamonds }: { gold: number; diamonds: number }) {
  return (
    <CardRail>
      {OFFERS.map(o => <OfferCard key={o.id} offer={o} gold={gold} diamonds={diamonds} />)}
    </CardRail>
  );
}

function GoldContent({ gold }: { gold: number }) {
  const [filter, setFilter] = useState("All");
  const categories = ["All","Elixirs","Shards","Materials"];
  const filtered = filter === "All" ? GOLD_ITEMS : GOLD_ITEMS.filter(i => i.category === filter);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className="px-3 py-1 rounded-lg font-black tracking-widest uppercase transition-all"
            style={{
              fontFamily:"'Rajdhani',sans-serif",fontSize:"var(--font-xs)",
              background:filter===cat?"linear-gradient(135deg,#fbbf24,#f97316)":"rgba(255,255,255,0.04)",
              color:filter===cat?"#070b14":"var(--text-muted)",
              border:filter===cat?"none":"1px solid rgba(255,255,255,0.1)",
            }}
          >
            {cat}
          </button>
        ))}
        <div
          className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-xl"
          style={{ background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)" }}
        >
          <span style={{ fontSize:"var(--font-md)" }}>🪙</span>
          <span className="font-mono font-bold tabular-nums" style={{ fontSize:"var(--font-sm)",color:"var(--accent-gold)" }}>
            {gold.toLocaleString()}
          </span>
        </div>
      </div>
      <CardRail>
        {filtered.map(i => <GoldCard key={i.id} item={i} gold={gold} />)}
      </CardRail>
    </div>
  );
}

function DiamondsContent({ diamonds }: { diamonds: number }) {
  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2">
        <span style={{ fontSize:"var(--font-xs)",color:"var(--text-muted)",fontFamily:"monospace" }}>
          Select a bundle — payment integration coming soon
        </span>
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-xl"
          style={{ background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.2)" }}
        >
          <span style={{ fontSize:"var(--font-md)" }}>💎</span>
          <span className="font-mono font-bold tabular-nums" style={{ fontSize:"var(--font-sm)",color:"#c4b5fd" }}>
            {diamonds.toLocaleString()}
          </span>
        </div>
      </div>
      <CardRail>
        {DIAMOND_BUNDLES.map(b => <DiamondCard key={b.id} bundle={b} />)}
      </CardRail>
    </div>
  );
}

// ─── MarketPage ───────────────────────────────────────────────────────────────
export default function MarketPage() {
  const { trainer } = useTrainer();
  const [tab, setTab] = useState<Tab>("offers");

  const gold     = trainer?.gold     ?? 0;
  const diamonds = trainer?.diamonds ?? 0;

  const TABS = [
    { id:"offers"   as Tab, label:"Offers",    icon:"🔥", color:"#f87171", bg:"rgba(230,57,70,0.18)",   border:"rgba(230,57,70,0.4)" },
    { id:"gold"     as Tab, label:"Gold Shop", icon:"🪙", color:"var(--accent-gold)", bg:"rgba(251,191,36,0.18)", border:"rgba(251,191,36,0.4)" },
    { id:"diamonds" as Tab, label:"Diamonds",  icon:"💎", color:"#c4b5fd", bg:"rgba(167,139,250,0.18)", border:"rgba(167,139,250,0.4)" },
  ];

  const ambientColor = tab === "offers" ? "rgba(230,57,70,0.07)" : tab === "gold" ? "rgba(251,191,36,0.07)" : "rgba(167,139,250,0.07)";

  return (
    <PageShell ambientColor={ambientColor}>
      <PageTopbar title="Market" />

      {/* Tab bar */}
      <div className="relative flex-shrink-0 flex items-center gap-1.5 px-4 py-2"
        style={{ background:"rgba(4,8,15,0.7)",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-black tracking-widest uppercase transition-all"
              style={{
                fontFamily:"'Rajdhani',sans-serif",fontSize:"var(--font-sm)",
                background:active?t.bg:"transparent",
                border:`1px solid ${active?t.border:"transparent"}`,
                color:active?t.color:"var(--text-muted)",
              }}>
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content — landscape, full height, horizontal scroll */}
      <div className="relative flex-1 flex items-stretch overflow-hidden" style={{ padding:"12px 0" }}>
        {tab === "offers"   && <OffersContent   gold={gold} diamonds={diamonds} />}
        {tab === "gold"     && <GoldContent     gold={gold} />}
        {tab === "diamonds" && <DiamondsContent diamonds={diamonds} />}
      </div>

    </PageShell>
  );
}
