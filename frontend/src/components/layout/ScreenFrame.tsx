import type { ReactNode } from "react";

export function ScreenFrame({
  title,
  tagline,
  children,
}: {
  title: string;
  tagline?: string;
  children: ReactNode;
}) {
  return (
    <div className="screen-frame">
      <header className="screen-frame-header">
        <div>
          <h2 className="screen-frame-title">{title}</h2>
          {tagline && <p className="screen-frame-tagline">{tagline}</p>}
        </div>
      </header>
      <div className="screen-frame-body">{children}</div>
    </div>
  );
}
