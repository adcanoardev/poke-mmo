// apps/client/src/context/TrainerContext.tsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken } from "../lib/api";

interface TrainerContextValue {
    trainer: any;
    tokens: any;
    fragments: number;
    reload: () => void;
    reset: () => void;
}

const TrainerContext = createContext<TrainerContextValue>({
    trainer: null,
    tokens: null,
    fragments: 0,
    reload: () => {},
    reset: () => {},
});

export function TrainerProvider({ children }: { children: React.ReactNode }) {
    const [trainer, setTrainer] = useState<any>(null);
    const [tokens, setTokens] = useState<any>(null);
    const [fragments, setFragments] = useState<number>(0);

    const load = useCallback(async () => {
        if (!getToken()) return; // ← sin token, no hay fetch
        try {
            const [t, tk, inv] = await Promise.all([api.trainer(), api.tokens(), api.inventory()]);
            setTrainer(t);
            setTokens(tk);
            const frag = (inv as any[]).find((i: any) => i.item === "FRAGMENT");
            setFragments(frag?.quantity ?? 0);
        } catch {}
    }, []);

    const reset = useCallback(() => {
        setTrainer(null);
        setTokens(null);
        setFragments(0);
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, 30_000);
        window.addEventListener("sidebar:reload", load);
        return () => {
            clearInterval(interval);
            window.removeEventListener("sidebar:reload", load);
        };
    }, [load]);

    return (
        <TrainerContext.Provider value={{ trainer, tokens, fragments, reload: load, reset }}>
            {children}
        </TrainerContext.Provider>
    );
}

export function useTrainer() {
    return useContext(TrainerContext);
}
