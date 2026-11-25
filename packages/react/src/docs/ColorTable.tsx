import { themes, type ColorRole } from "@tabellwerk/tokens";
import type { ReactNode } from "react";

const ROLES = Object.keys(themes.light) as ColorRole[];

function Swatch({ color }: { color: string }): ReactNode {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 20,
          height: 20,
          borderRadius: 4,
          border: "1px solid var(--tbw-color-border-strong)",
          background: color,
          forcedColorAdjust: "none",
        }}
      />
      <code>{color}</code>
    </span>
  );
}

/** The colour roles of `@tabellwerk/tokens` with their values in both themes. */
export function ColorTable(): ReactNode {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Custom property</th>
          <th scope="col">Light</th>
          <th scope="col">Dark</th>
        </tr>
      </thead>
      <tbody>
        {ROLES.map((role) => (
          <tr key={role}>
            <th scope="row">
              <code>--tbw-color-{role}</code>
            </th>
            <td>
              <Swatch color={themes.light[role]} />
            </td>
            <td>
              <Swatch color={themes.dark[role]} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
