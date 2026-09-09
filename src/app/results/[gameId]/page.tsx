import { ResultsClient } from "@/components/participant/results-client";

export default async function ResultsPage({ params }: { params: Promise<{ gameId: string }> }) {
  await params;
  return <ResultsClient />;
}
