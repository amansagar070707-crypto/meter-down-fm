import type { CSSProperties } from "react";

export function CoverArt({ palette, compact = false }: { palette: [string, string, string]; compact?: boolean }) {
  const style = {
    "--cover-a": palette[0],
    "--cover-b": palette[1],
    "--cover-c": palette[2],
  } as CSSProperties;

  return (
    <span className={compact ? "cover-art cover-art--compact" : "cover-art"} style={style} aria-hidden="true">
      <span className="cover-art__sun" />
      <span className="cover-art__road" />
      <span className="cover-art__auto" />
    </span>
  );
}
