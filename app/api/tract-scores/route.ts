import { NextResponse } from "next/server";
import tractScores from "@/data/tract-scores.json";

export async function GET() {
  return NextResponse.json(tractScores);
}
