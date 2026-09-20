import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #fff7ed 0%, #dcfce7 100%)",
          borderRadius: "7px",
          color: "#047857",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <svg width="27" height="27" viewBox="0 0 32 32" fill="none">
          <path
            d="M16 27C12.2 23.6 7 19.3 7 13.4C7 10.6 9.1 8.5 11.8 8.5C13.6 8.5 15 9.4 16 10.8C17 9.4 18.4 8.5 20.2 8.5C22.9 8.5 25 10.6 25 13.4C25 19.3 19.8 23.6 16 27Z"
            fill="#f97316"
          />
          <path
            d="M6 17H11.2L13.1 13.6L16.2 20.3L18.5 15.2H26"
            stroke="#065f46"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.4"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
