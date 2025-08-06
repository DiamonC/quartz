const express = require("express");
const Router = express.Router();


const stripeKey = require("../scripts/utils.js").getConfig().stripeKey;
const stripe = require("stripe")(stripeKey);

// Hash function (predictable, static salt)
function scrambleEmail(email) {
  
  return "coupon_"+email.split('')[3]+ email.split('')[2] + email.split('')[4] + email.split('')[1] + email.split('')[5];

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
      percent_off: 50,
      duration: "once",
      name: couponId,
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
  if (!id) return res.status(400).send("Missing email");

  const couponId = id;

  try {
    // Find all subscriptions or invoices using that coupon
    const invoices = await stripe.invoices.list({
      limit: 100,
    });

    const used = invoices.data.some(inv => inv.discount?.coupon?.id === couponId);
    res.send({ used });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error checking coupon usage");
  }
});

module.exports = Router;
