const express = require("express");
const Router = express.Router();


const stripeKey = require("../scripts/utils.js").getConfig().stripeKey;
const stripe = require("stripe")(stripeKey);

// Hash function (predictable, static salt)
function scrambleEmail(email) {
  
  return "coupon-"+email.split('')[3]+ email.split('')[2] + email.split('')[4] + email.split('')[1] + email.split('')[5];

}

// Route 1: referred_coupon
Router.get("/referred_coupon", async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).send("Missing email");

  const couponId = scrambleEmail(email);

  try {
    // Try to retrieve the coupon directly by ID
    const existing = await stripe.coupons.retrieve(couponId);
    if (existing && !existing.deleted) {
      return res.send(couponId);
    }
  } catch (err) {
    // If error is because coupon doesn't exist, proceed to create
    if (err.statusCode !== 404) {
      console.error(err);
      return res.status(500).send("Stripe error");
    }
  }

  try {
    await stripe.coupons.create({
      id: couponId,
      percent_off: 40,
      duration: "once",
      name: couponId,
    });

    //create the promotion code
    await stripe.promotionCodes.create({
      coupon: couponId,
      code: couponId,
    });

    res.send(couponId);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating coupon");
  }
});


// Route 2: referrer_coupon
Router.get("/referrer_coupon/:id", async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).send("Missing ID");
  const email = req.query.email;
  if (!email) return res.status(400).send("Missing email");

  const couponId = id;

  try {
    // Find all subscriptions or invoices using that coupon
    const invoices = await stripe.invoices.list({
      limit: 100,
    });

    const used = invoices.data.some(inv => inv.discount?.coupon?.id === couponId);
    if (used) {
        //create a new coupon
        let newId = "coupon-" + (() => Math.random().toString(36).slice(2, 2 + 8))();
        stripe.coupons.create({
          id: newId,
          percent_off: 50,
          duration: "once",
          name: newId,
        });
        // look for customer with that email
        const customers = await stripe.customers.list({
          email: email,
          limit: 1,
        }); 
        if (customers.data.length > 0) {
          //find the latest subscription of that customer
            const customer = customers.data[0];
            const subscriptions = await stripe.subscriptions.list({
              customer: customer.id,
              limit: 1,
            });
            if (subscriptions.data.length > 0) {
              const subscription = subscriptions.data[0];
              //apply the new coupon to the subscription
              await stripe.subscriptions.update(subscription.id, {
                coupon: newId,
              });
                return res.send({ used, success: true });
            } else {
                return res.send({ used, success: false });
            }
        } else {
            return res.send({ used, success: false });
        }
    


    } else {
    res.send({ used, success: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error checking coupon usage");
  }
});

// route to simply get current subscription price
Router.get('/price', async (req, res) => {
          console.log("test")
  if (req.query.mode === 'stripe') {
    let email = req.query.email;
    if (!email) return res.status(400).send("Missing email");
    try {
      const customers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (customers.data.length === 0) {
        return res.status(404).send("Customer not found");
      }

      const customer = customers.data[0];
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        return res.status(404).send("No active subscriptions found");
      }

      const sub = subscriptions.data[0];
      const item = sub.items.data[0];
      let price = `${(item.price.unit_amount / 100).toFixed(2)} ${item.price.currency.toUpperCase()}`;
    let halfOff = `${(Math.floor((item.price.unit_amount / 100 * 0.5) * 100) / 100).toFixed(2)} ${item.price.currency.toUpperCase()}`;

      res.json({
        price_id: item.price.id,
        price: price,
        half_off: halfOff
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch subscription price' });
    }
}
});

module.exports = Router;
