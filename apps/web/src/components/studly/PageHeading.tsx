import type { ReactNode } from "react";

export function PageHeading({ eyebrow = "STUDLY · КАМПУС", title, children, action }: { eyebrow?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return <header className="page-heading"><div><p className="page-eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <div className="page-intro">{children}</div>}</div>{action}</header>;
}
