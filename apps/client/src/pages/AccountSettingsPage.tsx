// apps/client/src/pages/AccountSettingsPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import PageShell from "../components/PageShell";
import PageTopbar from "../components/PageTopbar";

export default function AccountSettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [trainer, setTrainer] = useState<any>(null);
  const [section, setSection] = useState<"account" | "security">("account");

  // Username change
  const [newUsername, setNewUsername] = useState("");
  const [usernameMsg, setUsernameMsg] = useState("");
  const [changingUsername, setChangingUsername] = useState(false);

  // Password change
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    api.trainer().then(setTrainer).catch(() => {});
  }, []);

  const diamonds = trainer?.diamonds ?? 0;

  async function handleUsernameChange() {
    if (!newUsername.trim() || newUsername.length < 3) {
      setUsernameMsg("Minimum 3 characters.");
      return;
    }
    if (diamonds < 150) {
      setUsernameMsg("Not enough diamonds (need 150 💎).");
      return;
    }
    setChangingUsername(true);
    setUsernameMsg("");
    try {
      await api.changeUsername(newUsername.trim());
      setUsernameMsg("Username updated successfully!");
      setNewUsername("");
      // Dispatch so TrainerContext/AuthProvider pick up the new username
      window.dispatchEvent(new CustomEvent("auth:changed"));
    } catch (e: any) {
      setUsernameMsg(e.message ?? "Error updating username.");
    } finally {
      setChangingUsername(false);
    }
  }

  async function handlePasswordChange() {
    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdMsg("Please fill in all fields.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg("New passwords do not match.");
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg("Password must be at least 6 characters.");
      return;
    }
    setChangingPwd(true);
    setPwdMsg("");
    try {
      await api.changePassword(currentPwd, newPwd);
      setPwdMsg("Password changed successfully!");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (e: any) {
      setPwdMsg(e.message ?? "Error changing password.");
    } finally {
      setChangingPwd(false);
    }
  }

  const TABS = [
    { id: "account",  label: "Account" },
    { id: "security", label: "Security" },
  ] as const;

  return (
    <PageShell ambientColor="rgba(123,47,255,0.05)">
      <PageTopbar title="Account Settings" />

      <div className="relative flex-1 flex overflow-hidden">
        {/* Sidebar de secciones */}
        <div
          className="flex-shrink-0 flex flex-col py-6 px-4 gap-1"
          style={{
            width: 180,
            borderRight: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(4,8,15,0.4)",
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                textAlign: "left",
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                border: section === t.id
                  ? "1px solid rgba(123,47,255,0.3)"
                  : "1px solid transparent",
                background: section === t.id
                  ? "rgba(123,47,255,0.1)"
                  : "transparent",
                color: section === t.id ? "#a78bfa" : "#5a6a80",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}

          {/* Logout en sidebar */}
          <div style={{ marginTop: "auto", paddingTop: 24 }}>
            <button
              onClick={() => logout()}
              style={{
                width: "100%",
                padding: "9px 14px",
                borderRadius: 10,
                textAlign: "left",
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                border: "1px solid rgba(248,113,113,0.25)",
                background: "rgba(248,113,113,0.06)",
                color: "#f87171",
                transition: "all 0.15s",
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-8 py-6" style={{ scrollbarWidth: "none" }}>

          {/* ── ACCOUNT ── */}
          {section === "account" && (
            <div className="flex flex-col gap-6 max-w-lg">
              <div>
                <h2 style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: 20,
                  color: "#e2e8f0",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}>Account Info</h2>
                <p style={{ fontSize: 13, color: "#8892a4" }}>
                  Manage your Binder identity.
                </p>
              </div>

              {/* Info actual */}
              <div className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Row label="Username" value={user?.username ?? "—"} />
                <Row label="Email"    value={user?.email    ?? "—"} />
                <Row label="Diamonds" value={`${diamonds} 💎`} />
              </div>

              {/* Cambiar username */}
              <div className="rounded-2xl p-5 flex flex-col gap-4"
                style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <p style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 14, color: "#e2e8f0", letterSpacing: "0.06em", marginBottom: 4 }}>
                    Change Username
                  </p>
                  <p style={{ fontSize: 12, color: "#5a6a80" }}>
                    Costs <span style={{ color: "#a78bfa" }}>150 💎</span> — you have <span style={{ color: diamonds >= 150 ? "#a78bfa" : "#f87171" }}>{diamonds} 💎</span>
                  </p>
                </div>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="New username..."
                  maxLength={20}
                  style={inputStyle}
                />
                {usernameMsg && (
                  <p style={{ fontSize: 12, color: usernameMsg.includes("!") ? "#06d6a0" : "#f87171" }}>
                    {usernameMsg}
                  </p>
                )}
                <button
                  onClick={handleUsernameChange}
                  disabled={changingUsername || diamonds < 150}
                  style={{ ...btnStyle, opacity: (changingUsername || diamonds < 150) ? 0.4 : 1 }}
                >
                  {changingUsername ? "Changing..." : "Confirm — 150 💎"}
                </button>
              </div>
            </div>
          )}

          {/* ── SECURITY ── */}
          {section === "security" && (
            <div className="flex flex-col gap-6 max-w-lg">
              <div>
                <h2 style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: 20,
                  color: "#e2e8f0",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}>Security</h2>
                <p style={{ fontSize: 13, color: "#8892a4" }}>
                  Update your password.
                </p>
              </div>

              <div className="rounded-2xl p-5 flex flex-col gap-4"
                style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <label style={labelStyle}>Current Password</label>
                  <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder="••••••••" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>New Password</label>
                  <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="••••••••" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Confirm New Password</label>
                  <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="••••••••" style={inputStyle}
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordChange()} />
                </div>
                {pwdMsg && (
                  <p style={{ fontSize: 12, color: pwdMsg.includes("!") ? "#06d6a0" : "#f87171" }}>
                    {pwdMsg}
                  </p>
                )}
                <button onClick={handlePasswordChange} disabled={changingPwd}
                  style={{ ...btnStyle, opacity: changingPwd ? 0.4 : 1 }}>
                  {changingPwd ? "Saving..." : "Change Password"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 10 }}>
      <span style={{ fontSize: 12, color: "#8892a4", fontFamily: "'Exo 2', sans-serif" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "#e2e8f0",
  outline: "none",
  fontFamily: "'Exo 2', sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#8892a4",
  marginBottom: 6,
  fontFamily: "'Rajdhani', sans-serif",
};

const btnStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 0",
  borderRadius: 10,
  fontFamily: "'Rajdhani', sans-serif",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  border: "none",
  cursor: "pointer",
  background: "linear-gradient(135deg, #7b2fff, #4cc9f0)",
  color: "#fff",
  boxShadow: "0 0 20px rgba(123,47,255,0.3)",
  transition: "opacity 0.2s",
};
