import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const isFirstRun = useRef(true);

  useEffect(() => {
    // Don't scroll to top on initial load (let browser or page handle restoration)
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    // Scroll to the top of the page on route changes using a standards-safe value.
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto'
    });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
