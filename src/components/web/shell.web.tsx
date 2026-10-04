import { Link, type Href, usePathname } from 'expo-router';
import { type CSSProperties, type ReactNode } from 'react';

import { useAtlasAuth } from '@/auth/context';
import { Icon, type IconName } from '@/components/ui/icon';
import { useSettings } from '@/settings/context';
import { colors } from '@/theme';
import { useBrowserDevice, useDesktop, useStandalone } from '@/web/use-desktop';
import '@/web/desktop.css';

const NAV: { href: Href; label: string; icon: IconName; match: string[] }[] = [
  { href: '/', label: 'Overview', icon: 'home-outline', match: ['/'] },
  { href: '/trade', label: 'Explore & trade', icon: 'trending-up-outline', match: ['/trade'] },
  { href: '/perps', label: 'Perpetuals', icon: 'pulse-outline', match: ['/perps'] },
  { href: '/predictions', label: 'Predictions', icon: 'stats-chart-outline', match: ['/predictions', '/predictions-tab'] },
  { href: '/send', label: 'Send money', icon: 'paper-plane-outline', match: ['/send'] },
  { href: '/earn', label: 'Earn', icon: 'leaf-outline', match: ['/earn'] },
  { href: '/transactions', label: 'Activity', icon: 'time-outline', match: ['/transactions', '/transaction'] },
  { href: '/more', label: 'More to explore', icon: 'grid-outline', match: ['/more', '/mini', '/browse'] },
];
const tokens = {
  '--atlas-bg': colors.bgBase, '--atlas-panel': colors.bgSurface, '--atlas-panel-alt': colors.bgSurfaceAlt,
  '--atlas-nav': colors.bgTabBar, '--atlas-pink': colors.accentPink, '--atlas-pink-soft': colors.accentPinkTint,
  '--atlas-pink-deep': colors.accentPinkDeep, '--atlas-pink-dim': colors.accentPinkDim,
  '--atlas-text': colors.textPrimary, '--atlas-muted': colors.textSecondary, '--atlas-border': colors.border,
  '--atlas-success': colors.success,
} as CSSProperties;

export function WebLink({ href, children, className, ...props }: {
  href: Href; children: ReactNode; className?: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return <Link href={href} asChild><a className={className} {...props}>{children}</a></Link>;
}

export function AtlasWordmark() {
  return <span className="atlas-wordmark"><img className="atlas-mark" src="/atlas-icon.png" alt="" aria-hidden="true" />atlas<span className="atlas-brand-dot">.</span></span>;
}

export function WebShell({ children }: { children: ReactNode }) {
  const { authenticated, email } = useAtlasAuth();
  const { displayCurrency } = useSettings();
  const path = usePathname();
  const desktop = useDesktop();
  const device = useBrowserDevice();
  const standalone = useStandalone();
  const publicPage = !authenticated || path === '/install' || path.startsWith('/claim');
  const active = NAV.find((n) => n.match.some((m) => m === '/' ? path === '/' : path === m || path.startsWith(`${m}/`)));
  const title = active?.label ?? (path === '/profile' ? 'Your account' : path === '/deposit' || path === '/add-bank' ? 'Add money' : 'Your Atlas');
  return <div className={`atlas-shell ${desktop ? 'is-desktop' : 'is-mobile'} ${publicPage ? 'is-public' : 'is-account'}`} style={tokens}>
    <a className="atlas-skip" href="#atlas-main">Skip to content</a>
    <aside className="atlas-sidebar" aria-label="Main navigation">
      <WebLink href="/" className="atlas-brand-link" aria-label="Atlas home"><AtlasWordmark /></WebLink>
      <div className="atlas-sidebar-label">YOUR WORLD</div>
      <nav className="atlas-nav">{NAV.map((n) => <WebLink key={n.label} href={n.href} className={`atlas-nav-item ${active === n ? 'is-active' : ''}`} aria-current={active === n ? 'page' : undefined}>
        <Icon name={n.icon} size={21} color={active === n ? 'accentPinkTint' : 'textSecondary'} /><span>{n.label}</span>{active === n && <span className="atlas-nav-dot" />}
      </WebLink>)}</nav>
      <div className="atlas-sidebar-bottom">
        <div className="atlas-pocket"><span className="atlas-pocket-icon"><Icon name="phone-portrait-outline" size={23} color="accentPinkTint" /></span><h3>Atlas, wherever.</h3><p>Your whole world of money. Right in your pocket.</p><WebLink href="/install" className="atlas-btn atlas-btn-quiet">Get the app <Icon name="arrow-forward" size={16} /></WebLink></div>
        <WebLink href="/profile" className="atlas-account-link"><span className="atlas-user-dot">{(email?.[0] ?? 'A').toUpperCase()}</span><span><strong>Your account</strong><small>Settings & preferences</small></span><Icon name="chevron-forward" size={16} color="textSecondary" /></WebLink>
      </div>
    </aside>
    <div className="atlas-workspace">
      <header className="atlas-workspace-header"><div><span className="atlas-breadcrumb">MY ATLAS <span>/</span></span><strong>{title}</strong></div><div className="atlas-header-actions"><WebLink href="/trade" className="atlas-search-shortcut"><Icon name="search-outline" size={18} color="textSecondary" /><span>Find your next move</span></WebLink><WebLink href="/profile" className="atlas-currency">{displayCurrency}<Icon name="chevron-down" size={13} color="textSecondary" /></WebLink></div></header>
      <header className="atlas-public-header"><WebLink href={authenticated ? '/' : '/sign-in'} className="atlas-brand-link" aria-label="Atlas home"><AtlasWordmark /></WebLink><div className="atlas-public-actions">{path === '/sign-in' && <a className="atlas-text-link" href="#atlas-features">What you can do</a>}<WebLink href="/install" className="atlas-btn atlas-btn-quiet"><Icon name="download-outline" size={17} />Get Atlas</WebLink></div></header>
      {!desktop && !standalone && path !== '/install' && <div className="atlas-mobile-install"><span>{device === 'ios' ? 'Atlas, one tap from your Home Screen.' : 'Take Atlas with you.'}</span><WebLink href="/install">{device === 'ios' ? 'Add to Home Screen' : device === 'android' ? 'Download for Android' : 'Get the app'}<Icon name="arrow-forward" size={13} color="accentPinkTint" /></WebLink></div>}
      <main id="atlas-main" className="atlas-main" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
