import { useEffect, useState } from "react";

function pageIsVisible(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(pageIsVisible);

  useEffect(() => {
    const update = () => setVisible(pageIsVisible());
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);

  return visible;
}
