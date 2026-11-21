import { z } from 'zod'

// UX-only mirror of the server's checkout rules; the server's 422 stays the authority.

const tooLong = (attribute: string, max: number) => `Pole ${attribute} smí mít nejvýš ${max} znaků.`

const required = (message: string, attribute: string, max: number) =>
  z.string().trim().min(1, message).max(max, tooLong(attribute, max))

// Deliberately looser than the server's address rule: the client must never reject what the server accepts.
const hasLocalAndDomain = (value: string) => {
  const at = value.lastIndexOf('@')
  return at > 0 && at < value.length - 1
}

export const checkoutSchema = z.object({
  name: required('Vyplňte jméno a příjmení.', 'jméno a příjmení', 255),
  email: z
    .string()
    .trim()
    .min(1, 'Vyplňte e-mail.')
    .max(255, tooLong('e-mail', 255))
    .refine(hasLocalAndDomain, 'Zadejte platný e-mail.'),
  phone: required('Vyplňte telefon.', 'telefon', 30),
  street: required('Vyplňte ulici a číslo domu.', 'ulice a číslo domu', 255),
  city: required('Vyplňte město.', 'město', 255),
  zip: z
    .string()
    .trim()
    .min(1, 'Vyplňte PSČ.')
    .regex(/^\d{3}\s?\d{2}$/, 'PSČ má pět číslic, např. 110 00.'),
  note: z.string().trim().max(2000, 'Poznámka může mít nejvýš 2000 znaků.'),
})

export type CheckoutValues = z.infer<typeof checkoutSchema>

export const fieldLabels: Record<keyof CheckoutValues, string> = {
  name: 'Jméno a příjmení',
  email: 'E-mail',
  phone: 'Telefon',
  street: 'Ulice a číslo domu',
  city: 'Město',
  zip: 'PSČ',
  note: 'Poznámka',
}
