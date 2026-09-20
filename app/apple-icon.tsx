import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #fff7ed 0%, #fed7aa 45%, #dcfce7 100%)",
          borderRadius: "36px",
          color: "#047857",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <svg width="136" height="136" viewBox="0 0 180 180" fill="none">
          <path
            d="M90 150C68 130 38 105 38 72C38 55 51 42 68 42C78 42 86 47 90 55C94 47 102 42 112 42C129 42 142 55 142 72C142 105 112 130 90 150Z"
            fill="#f97316"
          />
          <path
            d="M32 92H64L76 70L94 112L108 82H148"
            stroke="#065f46"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="12"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
