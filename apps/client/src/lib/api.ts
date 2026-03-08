const BASE = "/api";

function getToken(): string | null {
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
    mineStatus: () => request<any>("/mine/me"),
    mineCollect: () => request<any>("/mine/collect", { method: "POST" }),
    battleNpcStart: () => request<any>("/battle/npc/start", { method: "POST" }),
    battleNpcTurn: (battleId: string, moveId: string) =>
        request<any>("/battle/npc/turn", { method: "POST", body: JSON.stringify({ battleId, moveId }) }),
    battleNpcFlee: (battleId: string) =>
        request<any>("/battle/npc/flee", { method: "POST", body: JSON.stringify({ battleId }) }),
    battleNpcActive: () => request<any>("/battle/npc/active"),
    battlePvp: (defenderUserId: string) =>
        request<any>("/battle/pvp", { method: "POST", body: JSON.stringify({ defenderUserId }) }),
    gyms: () => request<any[]>("/gyms"),
    challengeGym: (id: number) => request<any>(`/gyms/${id}/challenge`, { method: "POST" }),
    ranking: () => request<any>("/ranking"),
    onboardingData: () => request<any>("/onboarding/data"),
    onboardingComplete: (avatarId: string, gender: string, starterId: string) =>
        request<any>("/onboarding/complete", {
            method: "POST",
            body: JSON.stringify({ avatar: avatarId, gender, starterId }),
        }),
};
