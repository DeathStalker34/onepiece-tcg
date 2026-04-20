import { NextResponse } from 'next/server';

export function getUserId(req: Request): string | null {
  return req.headers.get('x-user-id');
}

export function requireUserId(req: Request): string | NextResponse {
  const id = getUserId(req);
  if (!id) return NextResponse.json({ error: 'missing x-user-id header' }, { status: 401 });
  return id;
}
