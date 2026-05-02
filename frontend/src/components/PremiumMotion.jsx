import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1];

export function PageTransition({ routeKey, children }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        className="premium-page"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: reduce ? 0.1 : 0.22, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** `slide={false}` = opacity cross-fade only (pairs better with hold screens that already stagger). */
export function SectionTransition({ sectionKey, children, className = "", slide = true }) {
  const reduce = useReducedMotion();
  const dur = reduce ? 0.1 : slide ? 0.2 : 0.16;
  const initial = reduce ? { opacity: 0 } : slide ? { opacity: 0, x: 10 } : { opacity: 0 };
  const animate = slide ? { opacity: 1, x: 0 } : { opacity: 1 };
  const exit = reduce ? { opacity: 0 } : slide ? { opacity: 0, x: -8 } : { opacity: 0 };
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={sectionKey}
        className={className}
        initial={initial}
        animate={animate}
        exit={exit}
        transition={{ duration: dur, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function Pressable({ as: Comp = "button", className = "", children, ...props }) {
  const onClick = (e) => {
    if (typeof performance !== "undefined") {
      const stamp = performance.now().toFixed(1);
      e.currentTarget?.setAttribute("data-last-press-ms", stamp);
    }
    props.onClick?.(e);
  };
  return (
    <Comp className={`premium-pressable ${className}`.trim()} {...props} onClick={onClick}>
      {children}
    </Comp>
  );
}

