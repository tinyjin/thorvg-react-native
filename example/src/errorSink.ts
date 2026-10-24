import type { ErrorHandler } from 'thorvg-react-native';

let sink: ErrorHandler | null = null;

export const reportError: ErrorHandler = (error, context) => {
  if (sink) sink(error, context);
  else console.warn(`[ThorVG] ${context.operation}: ${error.message}`);
};

export function setErrorSink(handler: ErrorHandler | null): void {
  sink = handler;
}
