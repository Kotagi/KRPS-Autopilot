import { ScreenFrame } from "../components/layout/ScreenFrame";

export function ComingSoonScreen({
  title,
  tagline,
  modules,
}: {
  title: string;
  tagline: string;
  modules: string[];
}) {
  return (
    <ScreenFrame title={title} tagline={tagline}>
      <section className="panel coming-soon-panel">
        <p className="meta coming-soon-lead">
          This screen is reserved in the mission shell. Modules will plug in here
          as they are built.
        </p>
        <ul className="coming-soon-list">
          {modules.map((module) => (
            <li key={module}>{module}</li>
          ))}
        </ul>
      </section>
    </ScreenFrame>
  );
}
