export type SelectableType = "body" | "vessel" | "sample" | "patch";

export interface SelectionDetail {
  id: string;
  label: string;
  type: SelectableType;
  detail: string;
}
