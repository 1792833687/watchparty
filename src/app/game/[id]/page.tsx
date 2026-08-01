/**
 * Game Page — AI Narrator Game
 *
 * Main game interface for a specific game session.
 * Route: /game/[id]
 *
 * Integrates all UI components from Sprint 3 Epic 5.
 */

import type { Metadata } from 'next';
import { GameClient } from '@/components/layout/GameClient';

interface GamePageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return [{ id: 'demo' }];
}

export async function generateMetadata({
  params,
}: GamePageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `游戏 — ${id} — AI Narrator Game`,
  };
}

export default async function GamePage({
  params,
}: GamePageProps): Promise<React.ReactElement> {
  const { id } = await params;
  // id is used by GameClient internally via stores
  void id;

  return <GameClient />;
}
