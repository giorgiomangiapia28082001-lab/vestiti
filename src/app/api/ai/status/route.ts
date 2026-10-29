import { connection } from "next/server";
import { getAIProvider } from "@/server/ai";

export async function GET() {
  await connection();
  const provider = getAIProvider();
  return Response.json({ enabled: Boolean(provider), provider: provider?.name ?? null });
}
