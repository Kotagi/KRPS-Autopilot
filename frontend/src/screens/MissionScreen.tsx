import { ComingSoonScreen } from "./ComingSoonScreen";

export function MissionScreen() {
  return (
    <ComingSoonScreen
      title="Mission"
      tagline="Visual drag-and-drop mission planner"
      modules={[
        "Flowchart nodes for target lock, ascent, and burns",
        "Branching conditions and wait steps",
        "Save and load mission profiles",
        "Run mission against live kRPC session",
      ]}
    />
  );
}
