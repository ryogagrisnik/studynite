import { NextResponse } from 'next/server';
import { GRE_VERBAL_BASE } from '@/data/gre_verbal_base';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get('mode') ?? 'random').toLowerCase(); // 'random' | 'concept'
  const concept = (searchParams.get('concept') ?? '').toUpperCase(); // 'TC' | 'SE' | 'RC'

  let pool = GRE_VERBAL_BASE;
  if (mode === 'concept') {
    if (!['TC','SE','RC'].includes(concept)) {
      return NextResponse.json({ ok:false, error:'Invalid concept. Use TC, SE, or RC.' }, { status: 400 });
    }
    pool = pool.filter(q => q.format === concept);
  }
  if (!pool.length) return NextResponse.json({ ok:false, error:'No questions.' }, { status: 404 });

  const idx = Math.floor(Math.random() * pool.length);
  const q = pool[idx];
  const id = `${q.format}-${idx}-${Date.now()}`;
  return NextResponse.json({ ok:true, question: { id, ...q } });
}
