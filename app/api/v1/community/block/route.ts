import { NextRequest } from 'next/server';
import { GET as handleGetBlock, POST as handlePostBlock } from '@/app/api/v1/users/block/route';

// GET /api/v1/community/block - List blocked users
export async function GET(request: NextRequest) {
  return handleGetBlock(request);
}

// POST /api/v1/community/block - Block or Unblock user via post_id or blocked_user_id
export async function POST(request: NextRequest) {
  return handlePostBlock(request);
}
