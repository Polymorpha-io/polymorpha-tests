import React from "react";
import { useDataStore } from "@/store/useDataStore";
import { CartModalContent } from "./CartModalContent";
import "./CartFab.css";

export function CartNavButton() {
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
        className="header-cart-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open selection"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span>Selection</span>
        <span className="header-cart-count">{cartCount}</span>
      </button>

      {open && (
        <div className="global-cart-overlay" onClick={() => setOpen(false)}>
          <div
            className="global-cart-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="global-cart-head">
              <h3>Selection</h3>
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
