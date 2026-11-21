import { z } from 'zod'

// Wire format (snake_case) of the shop JSON API. Prices are integer hellers.

export const categoryWire = z.object({ slug: z.string(), name: z.string() })

export const productWire = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number().int(),
  stock: z.number().int(),
  max_quantity: z.number().int(),
  image_url: z.string().nullable(),
  category: categoryWire,
})

export const cartItemWire = z.object({
  product_id: z.number().int(),
  quantity: z.number().int(),
  price: z.number().int(),
})

export const cartCheckWire = z.object({
  items: z.array(cartItemWire),
  messages: z.array(z.string()),
})

export const orderWire = z.object({
  number: z.string().nullable(),
  status: z.string(),
  items: z.array(
    z.object({
      product_id: z.number().int().nullable(),
      name: z.string(),
      unit_price: z.number().int(),
      quantity: z.number().int(),
      line_total: z.number().int(),
    }),
  ),
  total: z.number().int(),
  vat_rate: z.number().int(),
  vat_total: z.number().int(),
})

export const dataEnvelope = <T extends z.ZodType>(inner: T): z.ZodObject<{ data: T }> =>
  z.object({ data: inner })

export const cartChangedWire = z.object({
  code: z.literal('cart_changed'),
  messages: z.array(z.string()),
  items: z.array(cartItemWire),
})

export const cartAlreadyOrderedWire = z.object({
  code: z.literal('cart_already_ordered'),
  messages: z.array(z.string()),
})

export const throttledWire = z.object({
  code: z.string().optional(),
  messages: z.array(z.string()).min(1),
})

export const validationWire = z.object({
  message: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())),
})

type CamelCase<S extends string> = S extends `${infer H}_${infer T}`
  ? `${H}${Capitalize<CamelCase<T>>}`
  : S

type Camel<T> = T extends readonly (infer U)[]
  ? Camel<U>[]
  : T extends object
    ? { [K in keyof T as K extends string ? CamelCase<K> : K]: Camel<T[K]> }
    : T

export type Category = Camel<z.infer<typeof categoryWire>>
export type Product = Camel<z.infer<typeof productWire>>
export type CartItem = Camel<z.infer<typeof cartItemWire>>
export type CartCheckResult = Camel<z.infer<typeof cartCheckWire>>
export type Order = Camel<z.infer<typeof orderWire>>
