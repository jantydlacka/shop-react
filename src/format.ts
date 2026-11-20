const czk = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' })

export const formatPrice = (hellers: number): string => czk.format(hellers / 100)
