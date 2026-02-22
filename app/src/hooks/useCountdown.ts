import { useEffect, useState } from "react";

export function useCountdown(resolutionTime: number): string {
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    function compute() {
      const now = Math.floor(Date.now() / 1000);
      const diff = resolutionTime - now;

      if (diff <= 0) {
        setCountdown("Истёк");
        return;
      }

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (hours > 0) {
        setCountdown(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        );
      } else {
        setCountdown(
          `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        );
      }
    }

    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [resolutionTime]);

  return countdown;
}
