const BASE = "/api";

export function getToken(): string | null {
    return localStorage.getItem("token");
}
export function saveToken(token: string) {
    localStorage.setItem("token", token);
}
export function clearToken() {
    localStorage.removeItem("token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const token = getToken();
    const res = await fetch(`${BASE}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Request failed");
    }
    return res.json();
}

export const api = {
    login: (email: string, password: string) =>
        request<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    register: (username: string, email: string, password: string) =>
        request<{ token: string }>("/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, email, password }),
        }),
    me: () => request<{ id: string; username: string; email: string }>("/auth/me"),
    trainer: () => request<any>("/trainer/me"),
    tokens: () => request<any>("/tokens/me"),
    inventory: () => request<any[]>("/inventory/me"),
    party: () => request<any[]>("/creatures/party"),
    creatures: () => request<any[]>("/creatures/me"),
    partyUpdate: (party: { id: string; slot: number }[]) =>
        request<any>("/creatures/party/update", { method: "POST", body: JSON.stringify({ party }) }),
    mineStatus: () => request<any>("/mine/me"),
    mineCollect: () => request<any>("/mine/collect", { method: "POST" }),

    // Battle 3v3
    battleNpcStart: (order: string[]) =>
        request<any>("/battle/npc/start", { method: "POST", body: JSON.stringify({ order }) }),
    battleNpcTurn: (battleId: string, moveId: string, targetMythId?: string) =>
        request<any>("/battle/npc/turn", {
            method: "POST",
            body: JSON.stringify({ battleId, moveId, ...(targetMythId ? { targetMythId } : {}) }),
        }),
    battleNpcActive: () => request<any>("/battle/npc/active"),
    battlePvp: (defenderUserId: string) =>
        request<any>("/battle/pvp", { method: "POST", body: JSON.stringify({ defenderUserId }) }),
    battleStats: () => request<any>("/battle/stats"),

    sanctums: () => request<any[]>("/sanctums"),
    challengeSanctum: (id: number) => request<any>(`/sanctums/${id}/challenge`, { method: "POST" }),
    ranking: () => request<any>("/ranking"),
    onboardingData: () => request<any>("/onboarding/data"),
    onboardingComplete: (avatarId: string, gender: string, starterId: string) =>
        request<any>("/onboarding/complete", {
            method: "POST",
            body: JSON.stringify({ avatar: avatarId, gender, starterId }),
        }),
    // Forge
    forgeStatus: () => request<any>("/forge/me"),
    forgeCollect: () => request<any>("/forge/collect", { method: "POST" }),
    forgeOpen: () => request<any>("/forge/open", { method: "POST" }),

    // Lab
    labStatus: () => request<any>("/lab/me"),
    labCollect: () => request<any>("/lab/collect", { method: "POST" }),

    // Nursery
    nurseryStatus: () => request<any>("/nursery/me"),
    nurseryAssign: (creatureId: string) =>
        request<any>("/nursery/assign", { method: "POST", body: JSON.stringify({ creatureId }) }),
    nurseryCollect: () => request<any>("/nursery/collect", { method: "POST" }),
    nurseryRemove: () => request<any>("/nursery/remove", { method: "POST" }),
    nurseryUpgrade: () => request<any>("/nursery/upgrade", { method: "POST" }),

    // Structure upgrades
    mineUpgrade: () => request<any>("/mine/upgrade", { method: "POST" }),
    forgeUpgrade: () => request<any>("/forge/upgrade", { method: "POST" }),
    labUpgrade: () => request<any>("/lab/upgrade", { method: "POST" }),

    // Dex
    dex: () => request<any[]>("/dex"),
    dexById: (id: string) => request<any>(`/dex/${id}`),
};
