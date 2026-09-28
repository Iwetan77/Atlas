import { useBalance } from '@/api/balance';
import { HomeContent } from '@/components/home/home-content';

export default function HomeScreen() {
  return <HomeContent balance={useBalance()} />;
}
