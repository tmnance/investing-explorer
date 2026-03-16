import { useEffect } from 'react'

const APP_NAME = 'MarketScope'

export function usePageTitle(pageTitle: string) {
  useEffect(() => {
    if (pageTitle) {
      document.title = `${pageTitle} – ${APP_NAME}`
    } else {
      document.title = APP_NAME
    }
  }, [pageTitle])
}

