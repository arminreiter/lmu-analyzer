import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useClickOutside } from '../lib/useClickOutside';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  className?: string;
}

export interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

/** Right-click menu at the cursor; closes on outside click, Esc, scroll, resize or after an item runs */
export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });
  useClickOutside(ref, onClose);

  // Keep the menu on screen near the right/bottom edge
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({
      left: Math.max(0, Math.min(menu.x, window.innerWidth - el.offsetWidth - 4)),
      top: Math.max(0, Math.min(menu.y, window.innerHeight - el.offsetHeight - 4)),
    });
    el.querySelector('button')?.focus();
  }, [menu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  // Portal: data-card's clip-path would otherwise clip the menu
  return createPortal(
    <div ref={ref} role="menu" style={pos}
      className="fixed z-50 min-w-48 py-1 rounded-lg border border-racing-border bg-racing-card shadow-lg shadow-black/40">
      {menu.items.map(item => (
        <button key={item.label} role="menuitem"
          onClick={() => { onClose(); item.onClick(); }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-racing-highlight/20 focus:bg-racing-highlight/20 outline-none transition-colors cursor-pointer ${item.className ?? 'text-racing-text'}`}>
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
