import React from "react";
import "./message-skeleton.css";

export default function MessageSkeleton({ lines = 2 }: { lines?: number }) {
  const lineElems = Array.from({ length: lines }, (_, i) => (
    <div key={i} className="skeleton-line" />
  ));
  return (
    <div className="message-skeleton" aria-hidden="true">
      <div className="skeleton-avatar" />
      <div className="skeleton-body">
        {lineElems}
      </div>
    </div>
  );
}
