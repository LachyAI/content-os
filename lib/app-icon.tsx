import { ImageResponse } from "next/og";

// Same design as app/icon.svg: dark square, orange C. iOS rounds the apple icon itself, so that one is square.
export function appIconResponse(size: number, rounded: boolean) {
  return new ImageResponse(
    (
      <svg width={size} height={size} viewBox="0 0 512 512">
        <rect width="512" height="512" rx={rounded ? 96 : 0} fill="#111111" />
        <path
          d="M320 148c-15-10-38-20-68-20-72 0-120 52-120 128s48 128 120 128c30 0 55-10 70-22"
          fill="none"
          stroke="#E8922A"
          strokeWidth="48"
          strokeLinecap="round"
        />
      </svg>
    ),
    { width: size, height: size }
  );
}
