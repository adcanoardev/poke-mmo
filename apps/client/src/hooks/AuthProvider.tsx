import { useState, useEffect } from "react";
import { AuthContext } from "./useAuth";
import { api, saveToken, clearToken } from "../lib/api";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            setLoading(false);
            return;
        }
        api.me()
            .then(setUser)
            .catch(() => clearToken())
            .finally(() => setLoading(false));
    }, []);

    async function login(email: string, password: string) {
        const { token } = await api.login(email, password);
        saveToken(token);
        const me = await api.me();
        setUser(me);
    }

    async function register(username: string, email: string, password: string) {
        const { token } = await api.register(username, email, password);
        saveToken(token);
        const me = await api.me();
        setUser(me);
    }

    function logout() {
        clearToken();
        setUser(null);
    }

    return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
