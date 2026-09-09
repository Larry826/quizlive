import { GameControl } from "@/components/admin/game-control";

export default async function AdminGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <GameControl gameId={gameId} />;
}

