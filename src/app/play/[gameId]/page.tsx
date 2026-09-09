import { PlayClient } from "@/components/participant/play-client";

export default async function PlayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  return <PlayClient gameId={gameId} />;
}

