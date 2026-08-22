import React from "react";
import { useDataStore } from "@/store/useDataStore";
import { CartModalContent } from "./CartModalContent";
import "./CartFab.css";

export function CartFab() {
  const cart = useDataStore((s) => s.cart);
  const [open, setOpen] = React.useState(false);
  const cartCount = cart.length;

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (cartCount === 0) return null;

  return (
    <>
      <button
        className="global-cart-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open tests and visuals"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M9 14l2 2 4-4" />
        </svg>
        <span className="global-cart-fab-badge">{cartCount}</span>
      </button>
      {open && (
        <div className="global-cart-overlay" onClick={() => setOpen(false)}>
          <div
            className="global-cart-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="global-cart-head">
              <h3>Tests & Visuals</h3>
              <span className="global-cart-count">{cartCount}</span>
              <button
                className="global-cart-close"
                onClick={() => setOpen(false)}
                aria-label="Close selection"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <CartModalContent />
          </div>
        </div>
      )}
    </>
  );
}
