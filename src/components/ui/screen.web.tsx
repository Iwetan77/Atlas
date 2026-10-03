import { usePathname } from 'expo-router';
import type { ComponentProps } from 'react';
import { Screen as PhoneScreen } from './screen-base';
export { Pinned } from './screen-base';
import { useDesktop } from '@/web/use-desktop';

export function Screen({ style, ...props }: ComponentProps<typeof PhoneScreen>) {
  const desktop = useDesktop();
  const path = usePathname();
  const wide = ['/', '/trade', '/perps', '/more', '/transactions', '/earn', '/send'].includes(path) || path.startsWith('/trade/') || (path.startsWith('/perps/') && !path.startsWith('/perps/close/'));
  return <div className={`atlas-route-page ${desktop ? 'is-desktop' : ''}`} data-route={path}>
    <PhoneScreen {...props} style={[desktop && { maxWidth: wide ? 1240 : 740, paddingHorizontal: 32, paddingTop: 28, paddingBottom: 48, gap: 24 }, style]} />
  </div>;
}
