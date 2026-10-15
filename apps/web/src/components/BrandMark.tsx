type BrandMarkProps = {
  size?: number;
  variant?: "primary" | "inverse";
  background?: boolean;
};

export default function BrandMark({
  size = 96,
  variant = "primary",
  background = false,
}: BrandMarkProps) {
  const color = variant === "inverse" ? "#FFFFFF" : "#3547B8";
  const markWidth = background ? size : size * 0.7;

  return (
    <svg
      aria-hidden="true"
      width={markWidth}
      height={size}
      viewBox="0 0 112 160"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: "block",
        flexShrink: 0,
        borderRadius: background ? 28 : undefined,
        background: background
          ? variant === "inverse"
            ? "#3547B8"
            : "#E8ECFF"
          : undefined,
      }}
    >
      <path
        d="M75 5C83 1 92 4 97 11C103 20 100 30 92 35L52 60L79 66C92 69 101 76 101 86C101 93 97 98 90 102L38 136C28 143 17 139 12 131C7 122 10 112 19 106L55 83L28 79C15 77 7 69 7 60C7 53 11 48 18 44L75 5Z"
        fill={color}
        fillRule="evenodd"
      />
    </svg>
  );
}
