import React, { useEffect } from 'react';
import { autoUpdate, flip, FloatingPortal, hide, offset, shift, size, useDismiss, useFloating, useInteractions, useRole, useTransitionStyles } from '@floating-ui/react';
import { OutfitPopoverContent } from './outfit-popover-content';
import type { OutfitPopoverProps } from './outfit-popover';

export function OutfitPopover({ anchor, reduced, onDismiss, root: _root, ...content }: OutfitPopoverProps) {
  const { refs, floatingStyles, context, middlewareData } = useFloating({
    open: true, onOpenChange: open => { if (!open) onDismiss(); }, placement: 'right', strategy: 'fixed', transform: false,
    whileElementsMounted: (reference, floating, update) => autoUpdate(reference, floating, update, { animationFrame: true }),
    middleware: [offset(10), flip({ fallbackPlacements: ['left', 'bottom', 'top'], padding: 12 }), shift({ padding: 12 }), size({ padding: 12, apply({ availableHeight, elements }) { elements.floating.style.maxHeight = `${Math.max(44, availableHeight)}px`; } }), hide()],
  });
  useEffect(() => { refs.setReference(anchor as unknown as HTMLElement); }, [anchor, refs]);
  useEffect(() => { if (middlewareData.hide?.referenceHidden) onDismiss(); }, [middlewareData.hide?.referenceHidden, onDismiss]);
  const dismiss = useDismiss(context, { outsidePressEvent: 'pointerdown' });
  const role = useRole(context, { role: 'dialog' });
  const { getFloatingProps } = useInteractions([dismiss, role]);
  const { styles: transitionStyles } = useTransitionStyles(context, { duration: reduced ? 100 : 160, initial: { opacity: 0, transform: reduced ? 'none' : 'scale(.94)' }, open: { opacity: 1, transform: 'scale(1)' } });
  return <FloatingPortal>
    <div ref={refs.setFloating} {...getFloatingProps()} data-testid="outfit-popover" aria-label="单品换装" style={{ ...floatingStyles, zIndex: 1000, maxWidth: 'calc(100vw - 24px)', width: content.choosing ? 240 : 'max-content', outline: 'none', visibility: anchor ? 'visible' : 'hidden', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', ...transitionStyles, transitionDelay: reduced ? '0ms' : '80ms', background: 'rgba(255,250,244,.72)', backdropFilter: 'blur(18px) saturate(145%)', WebkitBackdropFilter: 'blur(18px) saturate(145%)', border: '1px solid rgba(255,255,255,.88)', borderRadius: 26, boxShadow: '0 8px 28px rgba(61,34,15,.12), inset 0 1px 0 rgba(255,255,255,.95)', padding: 4, overflow: 'hidden' }}>
        <OutfitPopoverContent {...content} />
      </div>
    </div>
    </FloatingPortal>;
}
