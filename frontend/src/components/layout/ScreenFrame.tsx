import type { ReactNode } from "react";

export function ScreenFrame({
  title,
  tagline,
  bodyClassName,
  children,
}: {
  title: string;
  tagline?: string;
  bodyClassName?: string;
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
      <div className={bodyClassName ? `screen-frame-body ${bodyClassName}` : "screen-frame-body"}>
        {children}
      </div>
    </div>
  );
}
