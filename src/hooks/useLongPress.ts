import { useCallback, useEffect, useRef, useState } from 'react';

interface LongPressOptions {
  onLongPress: () => void;
  delay?: number;
  movementTolerance?: number;
}

interface PressOrigin {
  pointerId: number;
  x: number;
  y: number;
}

export function useLongPress({
  onLongPress,
  delay = 520,
  movementTolerance = 9,
}: LongPressOptions) {
  const timerRef = useRef<number | null>(null);
  const originRef = useRef<PressOrigin | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    originRef.current = null;
    setIsPressing(false);
  }, []);

  const start = useCallback(
    (pointerId: number, x: number, y: number) => {
      cancel();
      originRef.current = { pointerId, x, y };
      setIsPressing(true);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        originRef.current = null;
        setIsPressing(false);
        onLongPress();
      }, delay);
    },
    [cancel, delay, onLongPress],
  );

  const move = useCallback(
    (pointerId: number, x: number, y: number) => {
      const origin = originRef.current;
      if (!origin || origin.pointerId !== pointerId) return;
      if (Math.hypot(x - origin.x, y - origin.y) > movementTolerance) cancel();
    },
    [cancel, movementTolerance],
  );

  useEffect(() => cancel, [cancel]);

  return { cancel, isPressing, move, start };
}
