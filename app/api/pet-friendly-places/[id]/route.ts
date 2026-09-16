import { NextRequest } from 'next/server';
import { GET as getSinglePlace } from '@/app/api/v1/places/[id]/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  return getSinglePlace(request, context);
}
