import { NextRequest } from 'next/server';
import { GET as placesGet, POST as placesPost } from '@/app/api/v1/places/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  return placesGet(request);
}

export async function POST(request: NextRequest) {
  return placesPost(request);
}
