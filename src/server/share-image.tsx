import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const shareSize = { width: 1200, height: 630 };
export const shareContentType = "image/png";

const font = readFile(join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"));

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export async function shareImage(title: string, description: string) {
  const heading = clip(title, 72);
  const data = await font;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#08090b",
        color: "#F2F4F7",
        padding: "72px",
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "28px",
            background: "#C8FF2E",
          }}
        />
        <div style={{ fontSize: "28px", color: "#C8FF2E" }}>BetInsight</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "22px", width: "1000px" }}>
        <div style={{ fontSize: heading.length > 36 ? "56px" : "72px", lineHeight: 1.05 }}>{heading}</div>
        <div style={{ fontSize: "28px", lineHeight: 1.35, color: "#A7B0BA" }}>{clip(description, 140)}</div>
      </div>
    </div>,
    {
      ...shareSize,
      fonts: [{ name: "Geist", data, weight: 400, style: "normal" }],
    },
  );
}
