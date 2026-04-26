// Stedly Protocol — Popover / Tooltip / SideDrawer primitives
//
// Three composable components that share positioning + animation + a11y:
//   <Tooltip>      lightweight on-hover hint, no backdrop, auto-flip
//   <Popover>      richer hover/click content (still small), arrow, escape
//   <SideDrawer>   full right-rail panel for detailed content (links, etc.)
//
// All three:
//   - ESC closes
//   - Outside click closes (Popover + Drawer)
//   - Auto-flip if not enough space (Tooltip + Popover)
//   - Mobile-aware: tap-to-open on touch devices instead of hover
//   - Reduced-motion respected
//   - prefers-reduced-motion = no entrance animation

(function () {
  const { useState, useEffect, useRef, useCallback, useLayoutEffect, createContext, useContext } = React;

  // Detect coarse pointer (= touch device).
  const isTouchDevice = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  };

  // ════════════════════════════════════════════════════════════════════
  //   <Tooltip>
  //   Hover-only on desktop, tap-to-toggle on mobile.
  //   Children = trigger element.
  //   content  = string or ReactNode shown in the tooltip body.
  //   placement = "top" | "bottom" | "left" | "right"  (default "top")
  // ════════════════════════════════════════════════════════════════════

  function Tooltip({ children, content, placement = "top", delayMs = 220, className = "" }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, place: placement });
    const triggerRef = useRef(null);
    const tipRef = useRef(null);
    const timerRef = useRef(null);
    const touch = useRef(isTouchDevice());

    const compute = useCallback(() => {
      const t = triggerRef.current;
      const p = tipRef.current;
      if (!t || !p) return;
      const tr = t.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      const margin = 8;
      let place = placement;
      let top = 0, left = 0;

      // Try requested placement; flip if not enough room.
      const fits = (pl) => {
        if (pl === "top")    return tr.top - pr.height - margin >= 0;
        if (pl === "bottom") return tr.bottom + pr.height + margin <= window.innerHeight;
        if (pl === "left")   return tr.left - pr.width - margin >= 0;
        if (pl === "right")  return tr.right + pr.width + margin <= window.innerWidth;
        return true;
      };
      if (!fits(place)) {
        const fallback = ["top", "bottom", "left", "right"].find(fits);
        if (fallback) place = fallback;
      }
      switch (place) {
        case "top":    top = tr.top - pr.height - margin;            left = tr.left + tr.width / 2 - pr.width / 2; break;
        case "bottom": top = tr.bottom + margin;                     left = tr.left + tr.width / 2 - pr.width / 2; break;
        case "left":   top = tr.top + tr.height / 2 - pr.height / 2; left = tr.left - pr.width - margin; break;
        case "right":  top = tr.top + tr.height / 2 - pr.height / 2; left = tr.right + margin; break;
      }
      // Clamp to viewport.
      left = Math.max(8, Math.min(left, window.innerWidth - pr.width - 8));
      top  = Math.max(8, Math.min(top, window.innerHeight - pr.height - 8));
      setPos({ top, left, place });
    }, [placement]);

    useLayoutEffect(() => { if (open) compute(); }, [open, compute]);

    useEffect(() => {
      if (!open) return;
      const onScroll = () => compute();
      const onResize = () => compute();
      const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onResize);
      document.addEventListener("keydown", onKey);
      return () => {
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("keydown", onKey);
      };
    }, [open, compute]);

    const onEnter = () => {
      if (touch.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setOpen(true), delayMs);
    };
    const onLeave = () => {
      clearTimeout(timerRef.current);
      setOpen(false);
    };
    const onTap = (e) => {
      if (!touch.current) return;
      e.stopPropagation();
      setOpen((o) => !o);
    };
    const onFocus = () => setOpen(true);
    const onBlur  = () => setOpen(false);

    // Outside-tap on mobile dismisses.
    useEffect(() => {
      if (!open || !touch.current) return;
      const onDoc = (e) => {
        if (triggerRef.current && triggerRef.current.contains(e.target)) return;
        if (tipRef.current && tipRef.current.contains(e.target)) return;
        setOpen(false);
      };
      document.addEventListener("touchstart", onDoc);
      return () => document.removeEventListener("touchstart", onDoc);
    }, [open]);

    if (!content) return children;

    // Wrap the child trigger.
    const triggerProps = {
      ref: (el) => {
        triggerRef.current = el;
        // Forward ref if the child has one.
        const childRef = children && children.ref;
        if (typeof childRef === "function") childRef(el);
        else if (childRef && typeof childRef === "object") childRef.current = el;
      },
      onMouseEnter: onEnter,
      onMouseLeave: onLeave,
      onClick: (e) => { onTap(e); if (children.props.onClick) children.props.onClick(e); },
      onFocus,
      onBlur,
      "aria-describedby": open ? "stedly-tooltip" : undefined,
    };

    // PORTAL: render the tip into document.body so backdrop-filter /
    // transform / contain ancestors don't trap our position:fixed.
    const tip = open && (
      <div
        ref={tipRef}
        id="stedly-tooltip"
        role="tooltip"
        className={`stedly-tooltip place-${pos.place} ${className}`}
        style={{ top: pos.top, left: pos.left }}>
        {content}
        <span className={`stedly-tooltip-arrow place-${pos.place}`} aria-hidden="true"/>
      </div>
    );

    return (
      <>
        {React.cloneElement(children, triggerProps)}
        {tip && ReactDOM.createPortal(tip, document.body)}
      </>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  //   <Popover>
  //   Click-to-toggle (or controlled). Heavier than Tooltip — supports
  //   interactive content and a header.
  // ════════════════════════════════════════════════════════════════════

  function Popover({ children, trigger, placement = "bottom", className = "", isOpen, onOpenChange }) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = isOpen !== undefined ? isOpen : internalOpen;
    const setOpen = (v) => {
      if (onOpenChange) onOpenChange(v);
      if (isOpen === undefined) setInternalOpen(v);
    };
    const [pos, setPos] = useState({ top: 0, left: 0, place: placement });
    const triggerRef = useRef(null);
    const popRef = useRef(null);

    const compute = useCallback(() => {
      const t = triggerRef.current;
      const p = popRef.current;
      if (!t || !p) return;
      const tr = t.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      const margin = 10;
      let place = placement;

      const fits = (pl) => {
        if (pl === "top")    return tr.top - pr.height - margin >= 0;
        if (pl === "bottom") return tr.bottom + pr.height + margin <= window.innerHeight;
        if (pl === "left")   return tr.left - pr.width - margin >= 0;
        if (pl === "right")  return tr.right + pr.width + margin <= window.innerWidth;
        return true;
      };
      if (!fits(place)) {
        const fallback = ["bottom", "top", "right", "left"].find(fits);
        if (fallback) place = fallback;
      }
      let top = 0, left = 0;
      switch (place) {
        case "top":    top = tr.top - pr.height - margin;            left = tr.left + tr.width / 2 - pr.width / 2; break;
        case "bottom": top = tr.bottom + margin;                     left = tr.left + tr.width / 2 - pr.width / 2; break;
        case "left":   top = tr.top + tr.height / 2 - pr.height / 2; left = tr.left - pr.width - margin; break;
        case "right":  top = tr.top + tr.height / 2 - pr.height / 2; left = tr.right + margin; break;
      }
      left = Math.max(8, Math.min(left, window.innerWidth - pr.width - 8));
      top  = Math.max(8, Math.min(top, window.innerHeight - pr.height - 8));
      setPos({ top, left, place });
    }, [placement]);

    useLayoutEffect(() => { if (open) compute(); }, [open, compute]);

    useEffect(() => {
      if (!open) return;
      const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
      const onDoc = (e) => {
        if (triggerRef.current && triggerRef.current.contains(e.target)) return;
        if (popRef.current && popRef.current.contains(e.target)) return;
        setOpen(false);
      };
      const onScroll = () => compute();
      const onResize = () => compute();
      document.addEventListener("keydown", onKey);
      document.addEventListener("mousedown", onDoc);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onResize);
      return () => {
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("mousedown", onDoc);
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onResize);
      };
    }, [open, compute]);

    const triggerEl = React.cloneElement(trigger, {
      ref: (el) => {
        triggerRef.current = el;
        const childRef = trigger.ref;
        if (typeof childRef === "function") childRef(el);
        else if (childRef && typeof childRef === "object") childRef.current = el;
      },
      onClick: (e) => {
        e.stopPropagation();
        setOpen(!open);
        if (trigger.props.onClick) trigger.props.onClick(e);
      },
      "aria-expanded": open,
      "aria-haspopup": "dialog",
    });

    // PORTAL out — same containing-block-trap fix as Tooltip.
    const pop = open && (
      <div
        ref={popRef}
        role="dialog"
        className={`stedly-popover place-${pos.place} ${className}`}
        style={{ top: pos.top, left: pos.left }}>
        {children}
        <span className={`stedly-popover-arrow place-${pos.place}`} aria-hidden="true"/>
      </div>
    );

    return (
      <>
        {triggerEl}
        {pop && ReactDOM.createPortal(pop, document.body)}
      </>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  //   <SideDrawer>
  //   Right-edge slide-in panel. Used for the link-forensics list +
  //   other "look at this in detail" content. Focus-trapped, ESC, click-
  //   outside-backdrop closes.
  //
  //   props:
  //     open       boolean
  //     onClose    () => void
  //     title      string for header
  //     subtitle   optional string under title
  //     width      px (default 440)
  // ════════════════════════════════════════════════════════════════════

  function SideDrawer({ open, onClose, title, subtitle, width = 440, children, footer }) {
    const drawerRef = useRef(null);
    const closeRef = useRef(null);

    useEffect(() => {
      if (!open) return;
      const prevActive = document.activeElement;
      // Focus the close button so ESC / Tab work intuitively.
      setTimeout(() => { if (closeRef.current) closeRef.current.focus(); }, 30);

      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
        if (e.key === "Tab") {
          const focusables = drawerRef.current?.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"]), input, select, textarea');
          if (!focusables || focusables.length === 0) return;
          const first = focusables[0], last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener("keydown", onKey);
      // Lock body scroll when drawer is open to prevent the page scrolling
      // behind the drawer.
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prevOverflow;
        if (prevActive && prevActive.focus) prevActive.focus();
      };
    }, [open, onClose]);

    if (!open) return null;
    // PORTAL: drawer lives at the body level so the overlay covers the
    // full viewport regardless of which workstation panel mounted it.
    const drawer = (
      <div className="stedly-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="presentation">
        <aside
          ref={drawerRef}
          className="stedly-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={title || "Side panel"}
          style={{ width }}>
          <header className="stedly-drawer-head">
            <div className="stedly-drawer-titles">
              {title && <h3 className="stedly-drawer-title">{title}</h3>}
              {subtitle && <div className="stedly-drawer-subtitle">{subtitle}</div>}
            </div>
            <button ref={closeRef} className="stedly-drawer-close" onClick={onClose} aria-label="Close panel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </header>
          <div className="stedly-drawer-body">
            {children}
          </div>
          {footer && <footer className="stedly-drawer-foot">{footer}</footer>}
        </aside>
      </div>
    );
    return ReactDOM.createPortal(drawer, document.body);
  }

  Object.assign(window, { Tooltip, Popover, SideDrawer, isTouchDevice });
})();
