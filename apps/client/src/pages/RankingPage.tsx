import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";

export default function RankingPage() {
    return (
        <Layout sidebar={<TrainerSidebar />}>
            <h1 className="font-display font-bold text-3xl tracking-widest mb-6">
                🏆 <span className="text-yellow">Ranking</span>
            </h1>
            <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted font-display tracking-widest">
                Próximamente
            </div>
        </Layout>
    );
}
