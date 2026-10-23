import { loadStripe } from '@stripe/stripe-js'

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

/** False until VITE_STRIPE_PUBLISHABLE_KEY is set in .env.local; online payments are then hidden and cash still works. */
export const stripeEnabled = !!key

let stripePromise
/** Stripe.js, loaded from Stripe's servers the first time a payment form is shown. */
export const getStripe = () => (stripePromise ??= loadStripe(key))
