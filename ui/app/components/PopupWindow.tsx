import React, { createContext, forwardRef, useContext, useState } from "react";
import { MaximizeIcon, MinimizeIcon } from "@dynatrace/strato-icons";
import "./PopupWindow.css";

const PopupContext = createContext({ maximized: false, toggle: () => {} });

export const PopupWindow = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function PopupWindow({ className = "", children, ...props }, ref) {
    const [maximized, setMaximized] = useState(false);
    return (
      <PopupContext.Provider value={{ maximized, toggle: () => setMaximized(value => !value) }}>
        <div {...props} ref={ref} role={props.role ?? "dialog"} data-popup-window=""
          style={{ ...props.style, ...(maximized ? { zIndex: props.style?.zIndex ?? 10000 } : {}) }}
          onMouseDownCapture={event => {
            if (maximized && (event.target as HTMLElement).closest('[style*="cursor: move"], [style*="cursor: grab"], [style*="-resize"]')) event.stopPropagation();
            props.onMouseDownCapture?.(event);
          }}
          className={`${className} iq-popup-window${maximized ? " iq-popup-maximized" : ""}`}>
          {children}
        </div>
      </PopupContext.Provider>
    );
  }
);

export function PopupToggle() {
  const { maximized, toggle } = useContext(PopupContext);
  const label = maximized ? "Restore window" : "Maximize window";
  return (
    <button type="button" className="iq-popup-toggle" title={label} aria-label={label} aria-pressed={maximized}
      onMouseDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); toggle(); }}>
      {maximized ? <MinimizeIcon /> : <MaximizeIcon />}
    </button>
  );
}

export function PopupCloseButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <span className="iq-popup-controls" style={{ marginLeft: props.style?.marginLeft }}>
      <PopupToggle />
      <button type="button" aria-label="Close window" {...props} style={{ ...props.style, marginLeft: 0 }} />
    </span>
  );
}

export function PopupStatusWindow({ children, onClose, style }: {
  children: React.ReactNode;
  onClose: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <PopupWindow style={{ background: "#1A1D23", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "24px 32px", ...style }}
      onClick={event => event.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <PopupCloseButton onClick={onClose} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 20 }}>&#x2715;</PopupCloseButton>
      </div>
      {children}
    </PopupWindow>
  );
}