import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

export const COMPANY_PLANS = {
  small:     { name: 'Small',     workerCap: 25,   monthly: 'price_1ThCOkAl0WsHlwKl5gGP8ydC', annual: 'price_1ThCXhAl0WsHIwKIZJGe9wLs' },
  medium:    { name: 'Medium',    workerCap: 75,   monthly: 'price_1ThChUAl0WsHlwKlLWUHsv93', annual: 'price_1ThCi4Al0WsHIwKIKaMA5rC9' },
  large:     { name: 'Large',     workerCap: 250,  monthly: 'price_1ThCjIAl0WsHIwKIgwDdypWE', annual: 'price_1ThCjkAl0WsHIwKIMjTvdu4Z' },
  unlimited: { name: 'Unlimited', workerCap: null, monthly: 'price_1ThCkmAl0WsHIwKI5TQj7FPE', annual: 'price_1ThClAAl0WsHIwKIMNdrT7co' },
} as const

export const AGENCY_PLANS = {
  small:      { name: 'Small',      workerCap: 50,   monthly: 'price_1ThCmLAl0WsHIwKIol8DCxaH', annual: 'price_1ThCmcAl0WsHIwKIdaa8k307' },
  medium:     { name: 'Medium',     workerCap: 150,  monthly: 'price_1ThCnfAl0WsHIwKIbkR40gp7', annual: 'price_1ThCo2Al0WsHIwKIE5IDqTMp' },
  large:      { name: 'Large',      workerCap: 500,  monthly: 'price_1ThCpCAl0WsHIwKICRECXbDO', annual: 'price_1ThCpTAl0WsHIwKIDUhLcU51' },
  enterprise: { name: 'Enterprise', workerCap: null, monthly: 'price_1ThCqLAl0WsHIwKIdmBVf582', annual: 'price_1ThCqlAl0WsHIwKIZwV40j5D' },
} as const

export type CompanyPlanKey = keyof typeof COMPANY_PLANS
export type AgencyPlanKey = keyof typeof AGENCY_PLANS
