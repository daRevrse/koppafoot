import { NextResponse } from "next/server";
import { getConfirmedMovements } from "@/lib/mercato-admin";

// Public read of confirmed transfers.
//
// No auth check, deliberately: a signed move is public information, and the
// point of this route is that a visitor with no account can see the market
// is alive. Pending requests never come through here, getConfirmedMovements
// filters on status == "accepted", so nothing private leaks.

export const revalidate = 300;

export async function GET() {
  const movements = await getConfirmedMovements(24);
  return NextResponse.json(
    { movements },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
