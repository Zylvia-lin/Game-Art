"use client";

import { useState, useCallback, useRef } from 'react';

/**
 * Hook to enforce a minimum cooldown period after button click.
 * Prevents rapid double-clicks on generation/submit buttons.
 * 
 * @param cooldownMs Cooldown duration in milliseconds (default: 2000)
 * @returns { isCoolingDown, triggerCooldown } 
 *   - isCoolingDown: boolean indicating if the button is in cooldown
 *   - triggerCooldown: call this to start the cooldown timer
 */
export function useButtonCooldown(cooldownMs: number = 2000) {
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCooldown = useCallback(() => {
    setIsCoolingDown(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsCoolingDown(false);
      timerRef.current = null;
    }, cooldownMs);
  }, [cooldownMs]);

  return { isCoolingDown, triggerCooldown };
}
