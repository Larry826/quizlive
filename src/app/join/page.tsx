import { JoinClient } from "@/components/participant/join-client";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ pin?: string }> }) {
  const params = await searchParams;
  return <JoinClient initialPin={params.pin ?? ""} />;
}
