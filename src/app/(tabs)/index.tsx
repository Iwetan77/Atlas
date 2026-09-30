import { useBalance } from '@/api/balance';
import { useSpotPositions } from '@/api/positions';
import { HomeContent } from '@/components/home/home-content';

export default function HomeScreen() {
  return <HomeContent balance={useBalance()} positions={useSpotPositions()} />;
}
