// apps/client/src/components/MailPanel.tsx
import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────

interface MailAttachment {
  gold?: number;
  diamonds?: number;
  essences?: number;
  goldEssences?: number;
  items?: { itemSlug: string; qty: number }[];
}

interface MailMessage {
  id: string;
  type: "SYSTEM" | "GUILD" | "PROMO";
  title: string;
  body: string;
  isRead: boolean;
  claimedAt: string | null;
  expiresAt: string;
  createdAt: string;
  attachments: MailAttachment | null;
  actionData: any;
}

// ─── Icons ────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  SYSTEM: "⚙️",
  GUILD:  "⚔️",
  PROMO:  "🎁",
};

const TYPE_COLOR: Record<string, string> = {
  SYSTEM: "#67e8f9",
  GUILD:  "#a78bfa",
  PROMO:  "#fbbf24",
};

// ─── Attachment display ───────────────────────────────────────

function AttachmentRow({ att }: { att: MailAttachment }) {
  const parts: string[] = [];
  if (att.gold)          parts.push(`${att.gold.toLocaleString()} 🪙`);
  if (att.diamonds)      parts.push(`${att.diamonds} 💎`);
  if (att.essences)      parts.push(`${att.essences} 🔮`);
  if (att.goldEssences)  parts.push(`${att.goldEssences} ✨`);
  if (att.items)         att.items.forEach(i => parts.push(`${i.qty}× ${i.itemSlug.replace(/_/g, " ")}`));
  if (parts.length === 0) return null;
  return (
    <div style={{
      marginTop: 8,
      padding: "6px 10px",
      borderRadius: 8,
      background: "rgba(251,191,36,0.06)",
      border: "1px solid rgba(251,191,36,0.15)",
      fontSize: 12,
      color: "#fbbf24",
      fontFamily: "monospace",
      letterSpacing: "0.04em",
    }}>
      {parts.join("  ·  ")}
    </div>
  );
}

// ─── Single message card ──────────────────────────────────────

function MailCard({
  msg,
  onRead,
  onClaim,
  onDelete,
}: {
  msg: MailMessage;
  onRead: (id: string) => void;
  onClaim: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [claiming, setClaiming] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hasClaim = !!msg.attachments && !msg.claimedAt;
  const isClaimed = !!msg.claimedAt;
  const typeColor = TYPE_COLOR[msg.type] ?? "#67e8f9";
  const daysLeft = Math.ceil((new Date(msg.expiresAt).getTime() - Date.now()) / 86400000);

  async function handleClaim(e: React.MouseEvent) {
    e.stopPropagation();
    setClaiming(true);
    try {
      await onClaim(msg.id);
    } finally {
      setClaiming(false);
    }
  }

  function handleExpand() {
    setExpanded(v => !v);
    if (!msg.isRead) onRead(msg.id);
  }

  return (
    <div
      onClick={handleExpand}
      style={{
        borderRadius: 12,
        background: msg.isRead ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${msg.isRead ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)"}`,
        padding: "10px 12px",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        position: "relative",
      }}
    >
      {/* Unread dot */}
      {!msg.isRead && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: 7, height: 7, borderRadius: "50%",
          background: typeColor,
          boxShadow: `0 0 6px ${typeColor}`,
        }} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <span style={{ fontSize: 13 }}>{TYPE_ICON[msg.type]}</span>
        <span style={{
          flex: 1,
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.06em",
          color: msg.isRead ? "#94a3b8" : "#e2e8f0",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingRight: 14,
        }}>
          {msg.title}
        </span>
      </div>

      {/* Type badge + expiry */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: expanded ? 8 : 0 }}>
        <span style={{
          fontSize: 10,
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 900,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: typeColor,
          opacity: 0.8,
        }}>
          {msg.type}
        </span>
        <span style={{ fontSize: 10, color: "#5a6a80", fontFamily: "monospace" }}>
          · {daysLeft > 0 ? `${daysLeft}d left` : "expiring"}
        </span>
        {isClaimed && (
          <span style={{ fontSize: 10, color: "#34d399", fontFamily: "monospace" }}>· claimed</span>
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div>
          <p style={{
            fontSize: 12,
            color: "#8892a4",
            lineHeight: 1.55,
            marginBottom: msg.attachments ? 0 : 8,
          }}>
            {msg.body}
          </p>

          {msg.attachments && <AttachmentRow att={msg.attachments} />}

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {hasClaim && (
              <button
                onClick={handleClaim}
                disabled={claiming}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: 8,
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  border: "none",
                  cursor: claiming ? "not-allowed" : "pointer",
                  background: claiming
                    ? "rgba(251,191,36,0.1)"
                    : "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.1))",
                  color: "#fbbf24",
                  border1: "1px solid rgba(251,191,36,0.3)",
                  opacity: claiming ? 0.6 : 1,
                  transition: "opacity 0.15s",
                } as any}
              >
                {claiming ? "Claiming..." : "Claim Rewards"}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(msg.id); }}
              style={{
                width: 32,
                padding: "8px 0",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.03)",
                color: "#5a6a80",
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              🗑
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MailPanel ────────────────────────────────────────────────

interface MailPanelProps {
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

export default function MailPanel({ onClose, onUnreadChange }: MailPanelProps) {
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "SYSTEM" | "GUILD" | "PROMO">("ALL");

  const fetchMail = useCallback(async () => {
    try {
      const { messages: msgs, unreadCount } = await api.mail();
      setMessages(msgs);
      onUnreadChange?.(unreadCount);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => { fetchMail(); }, [fetchMail]);

  async function handleRead(id: string) {
    try {
      await api.mailRead(id);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
      const newUnread = messages.filter(m => !m.isRead && m.id !== id).length;
      onUnreadChange?.(newUnread);
    } catch { /* silent */ }
  }

  async function handleClaim(id: string) {
    try {
      await api.mailClaim(id);
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, claimedAt: new Date().toISOString(), isRead: true } : m
      ));
    } catch (e: any) {
      // Could show a toast here
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.mailDelete(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch { /* silent */ }
  }

  async function handleReadAll() {
    try {
      await api.mailReadAll();
      setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
      onUnreadChange?.(0);
    } catch { /* silent */ }
  }

  const filtered = filter === "ALL"
    ? messages
    : messages.filter(m => m.type === filter);

  const unreadCount = messages.filter(m => !m.isRead).length;

  const FILTERS = ["ALL", "SYSTEM", "GUILD", "PROMO"] as const;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 990,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380,
          height: "min(560px, 82dvh)",
          background: "rgba(7,11,20,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          display: "flex", flexDirection: "column",
          fontFamily: "'Exo 2', sans-serif",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(4,8,15,0.95)",
        }}>
          <span style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#e2e8f0",
            flex: 1,
          }}>
            ✉️ Mailbox
            {unreadCount > 0 && (
              <span style={{
                marginLeft: 8,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                background: "#f87171",
                color: "#fff",
                fontSize: 10,
                fontFamily: "monospace",
                fontWeight: 700,
                padding: "0 4px",
              }}>
                {unreadCount}
              </span>
            )}
          </span>

          {unreadCount > 0 && (
            <button
              onClick={handleReadAll}
              style={{
                padding: "4px 10px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "#5a6a80",
                fontSize: 11,
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Read all
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              width: 26, height: 26, borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.4)",
              fontSize: 14,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>

        {/* ── Filter tabs ── */}
        <div style={{
          flexShrink: 0,
          display: "flex", gap: 4,
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1,
                padding: "5px 0",
                borderRadius: 8,
                border: `1px solid ${filter === f ? "rgba(103,232,249,0.3)" : "rgba(255,255,255,0.06)"}`,
                background: filter === f ? "rgba(103,232,249,0.08)" : "transparent",
                color: filter === f ? "#67e8f9" : "#5a6a80",
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 900,
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── Messages list ── */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          scrollbarWidth: "none",
        }}>
          {loading && (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#5a6a80", fontSize: 12, fontFamily: "monospace",
            }}>
              Loading...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <span style={{ fontSize: 28, opacity: 0.25 }}>✉️</span>
              <span style={{
                fontSize: 12, color: "rgba(255,255,255,0.2)",
                fontFamily: "monospace", letterSpacing: "0.1em",
              }}>
                NO MESSAGES
              </span>
            </div>
          )}

          {!loading && filtered.map(msg => (
            <MailCard
              key={msg.id}
              msg={msg}
              onRead={handleRead}
              onClaim={handleClaim}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
