const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Map each tier to its Stripe Price ID
// Create these in your Stripe Dashboard (Products → one-time prices)
// then paste the price_xxx IDs into your Netlify environment variables
const TIERS = [
  { min: 100,  max: 249,    priceId: process.env.STRIPE_PRICE_STARTER  }, // $3.00/letter
  { min: 250,  max: 499,    priceId: process.env.STRIPE_PRICE_GROWTH   }, // $2.79/letter
  { min: 500,  max: 799,    priceId: process.env.STRIPE_PRICE_PRO      }, // $2.69/letter
  { min: 800,  max: 999,    priceId: process.env.STRIPE_PRICE_GOLDBAR  }, // $2.49/letter
  { min: 1000, max: 999999, priceId: process.env.STRIPE_PRICE_ALLIN    }, // $2.33/letter
];

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { name, email, phone, brokerage, quantity } = body;
  const qty = parseInt(quantity);

  // Basic server-side validation
  if (!name || !email || !phone || !qty) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  if (qty < 100) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Minimum order is 100 letters' }) };
  }

  // Find the correct pricing tier
  const tier = TIERS.find(t => qty >= t.min && qty <= t.max);
  if (!tier || !tier.priceId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Could not determine pricing tier. Check Stripe Price IDs in env.' })
    };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,

      line_items: [
        {
          price: tier.priceId,
          quantity: qty,
        }
      ],

      // Store order details for your records — visible in Stripe Dashboard
      metadata: {
        customer_name: name,
        phone,
        brokerage,
        quantity: qty,
        tier: tier.priceId,
      },

      // Redirect URLs — update YOUR_DOMAIN to your Netlify site URL
      success_url: `${process.env.SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}&qty=${qty}`,
      cancel_url: `${process.env.SITE_URL}/order.html`,

      // Optional: collect billing address for your records
      billing_address_collection: 'auto',
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create checkout session' }),
    };
  }
};
