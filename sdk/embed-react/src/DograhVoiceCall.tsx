import type { ReactNode } from "react";

import type { UseDograhVoiceCallOptions } from "./types.js";
import { useDograhVoiceCall } from "./use-dograh-voice-call.js";

export interface DograhVoiceCallProps extends UseDograhVoiceCallOptions {
  className?: string;
  children?: (state: ReturnType<typeof useDograhVoiceCall>) => ReactNode;
}

/**
 * Optional render-prop wrapper around {@link useDograhVoiceCall}.
 * Supply your own UI; this component renders no chrome by default.
 */
export function DograhVoiceCall({
  className,
  children,
  ...options
}: DograhVoiceCallProps) {
  const state = useDograhVoiceCall(options);

  if (children) {
    return <>{children(state)}</>;
  }

  return (
    <div className={className} data-dograh-call-status={state.status}>
      <button
        type="button"
        disabled={!state.isReady || state.status === "connecting"}
        onClick={() => {
          if (state.status === "connected" || state.status === "connecting") {
            state.end();
          } else {
            void state.start();
          }
        }}
      >
        {state.status === "connected" || state.status === "connecting"
          ? "End call"
          : "Start call"}
      </button>
      {state.error ? (
        <p role="alert">{state.error.message}</p>
      ) : null}
    </div>
  );
}
