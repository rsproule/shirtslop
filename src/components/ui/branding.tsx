interface BrandingProps {
  size?: "small" | "medium" | "large";
  showTagline?: boolean;
  className?: string;
  onClick?: () => void;
}

export function Branding({
  size = "medium",
  showTagline = false,
  className = "",
  onClick,
}: BrandingProps) {
  const sizeClasses = {
    small: {
      logo: "h-8 sm:h-12",
      text: "text-lg sm:text-2xl",
      tagline: "text-sm sm:text-base",
    },
    medium: {
      logo: "h-20 sm:h-28",
      text: "text-4xl sm:text-6xl",
      tagline: "text-lg sm:text-xl",
    },
    large: {
      logo: "h-24 sm:h-32 md:h-40",
      text: "text-5xl sm:text-7xl md:text-9xl",
      tagline: "text-lg sm:text-2xl",
    },
  };

  const classes = sizeClasses[size];

  return (
    <div
      className={`flex items-center ${onClick ? "cursor-pointer transition-opacity hover:opacity-80" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <img
          src="/shirtslop.png"
          alt="ShirtSlop Logo"
          className={`${classes.logo} w-auto object-contain drop-shadow-lg`}
        />
        <span className={`${classes.text} font-bold text-gray-800`}>
          ShirtSlop
        </span>
      </div>
      {showTagline && (
        <p className={`${classes.tagline} ml-4 font-medium text-gray-600`}>
          AI-powered shirt design
        </p>
      )}
    </div>
  );
}
