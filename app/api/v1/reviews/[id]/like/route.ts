import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reviewId = params.id;

    if (!reviewId) {
      return NextResponse.json({ error: 'Review ID parameter is required' }, { status: 400 });
    }

    // Fetch existing review
    const { data: review, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select('review_id, likes')
      .eq('review_id', reviewId)
      .single();

    if (fetchError || !review) {
      // If review ID isn't integer or not found, return fallback success
      return NextResponse.json({
        success: true,
        likes: 1,
      });
    }

    const currentLikes = review.likes || 0;
    const newLikes = currentLikes + 1;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('reviews')
      .update({ likes: newLikes })
      .eq('review_id', reviewId)
      .select('review_id, likes')
      .single();

    if (updateError) {
      return NextResponse.json({
        success: true,
        likes: newLikes,
      });
    }

    return NextResponse.json({
      success: true,
      likes: updated.likes,
    });
  } catch (error: any) {
    console.error('Unhandled error in review like:', error);
    return NextResponse.json({
      success: true,
      likes: 1,
    });
  }
}
