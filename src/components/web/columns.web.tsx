import type { ColumnsProps } from './columns';
import { useDesktop } from '@/web/use-desktop';
export function DesktopColumns({ children }: ColumnsProps) { return useDesktop() ? <div className="atlas-option-columns">{children}</div> : <>{children}</>; }
