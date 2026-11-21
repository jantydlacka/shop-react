const SHOP_NAME = 'Obchod'

/** React 19 hoists a rendered <title> into <head>; the page that is mounted owns it. */
export function PageTitle({ page }: { page?: string }) {
  return <title>{page ? `${page} – ${SHOP_NAME}` : SHOP_NAME}</title>
}
