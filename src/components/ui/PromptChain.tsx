type PromptChainProps = {
  chain?: string[];
  prompt: string;
  mode: "condensed" | "full";
  className?: string;
};

function renderLine(text: string, index: number) {
  const isFirst = index === 0;
  const number = index + 1;
  return (
    <div key={`${number}-${text}`}>
      {isFirst ? (
        <>
          {number}. <em>"{text}"</em>
        </>
      ) : (
        <>
          {number}. <em>"{text}"</em>
        </>
      )}
    </div>
  );
}

export function PromptChain({
  chain,
  prompt,
  mode,
  className,
}: PromptChainProps) {
  const effectiveChain =
    Array.isArray(chain) && chain.length > 0 ? chain : [prompt];

  if (mode === "condensed") {
    // 3+ steps: show first and last, with a middle indicator
    if (effectiveChain.length > 2) {
      const first = effectiveChain[0];
      const last = effectiveChain[effectiveChain.length - 1];
      const hiddenCount = effectiveChain.length - 2;
      return (
        <div className={className ? className + " text-left" : "text-left"}>
          <div className="mb-1 truncate">{renderLine(first, 0)}</div>
          <div className="text-muted-foreground/70 mb-1 text-xs">
            ... {hiddenCount} more steps ...
          </div>
          <div className="truncate">
            {renderLine(last, effectiveChain.length - 1)}
          </div>
        </div>
      );
    }

    // 2 steps: show both, truncated
    if (effectiveChain.length === 2) {
      return (
        <div className={className ? className + " text-left" : "text-left"}>
          <div className="mb-1 truncate">
            {renderLine(effectiveChain[0], 0)}
          </div>
          <div className="truncate">{renderLine(effectiveChain[1], 1)}</div>
        </div>
      );
    }

    // Single prompt
    return (
      <div
        className={(className ? className + " " : "") + "truncate text-left"}
      >
        <em>"{effectiveChain[0]}"</em>
      </div>
    );
  }

  // Full mode: show every line without truncation
  return (
    <div className={className ? className + " text-left" : "text-left"}>
      {effectiveChain.map((text, idx) => (
        <div key={`${idx}-${text}`} className="mb-1 last:mb-0">
          {renderLine(text, idx)}
        </div>
      ))}
    </div>
  );
}

export default PromptChain;
