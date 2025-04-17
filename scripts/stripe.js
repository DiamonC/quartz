let stripeKey = require("./utils.js").getConfig().stripeKey;
const stripe = require("stripe")(stripeKey);
const express = require("express");

async function getCustomerID(email) {
  try {
    const customers = await stripe.customers.list({ limit: 100, email: email });
    if (customers.data.length > 0) {
      const customer_id = customers.data[0].id;

      return customer_id;
    } else {
      return null;
    }
  } catch (err) {
    console.log(err);
    return null;
  }
}

function checkSubscription(email) {
  const cid = getCustomerID(email);

  //wait 5 seconds
  setTimeout(function () {
    console.log("waiting");

    stripe.subscriptions.list({ customer: cid }, function (err, subscriptions) {
      if (err) {
        console.log(err);
      } else {
        if (
          subscriptions.data[0] != undefined &&
          subscriptions.data[0].id.length > 0
        ) {
          console.log("Subscribed: " + subscriptions.data[0].id);
          return subscriptions;
        } else {
          if (subscriptions.data[0] != undefined) {
            console.log(subscriptions.data);
          }
          console.log("Not subscribed");
          return subscriptions;
        }
      }
    });
  }, 5000);
}
//get the last 4 digits of customer's card ( )
async function getCreditId(email) {
  const cid = await getCustomerID(email);
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: cid,
      type: "card",
    });
    return paymentMethods.data[0].card.last4;
  } catch (err) {
    console.log("Error retrieving customer payment method:", err);
    return null;
  }
}

async function getCustomers() {
  try {
    let data = [];
    const customers = await stripe.customers.list({ limit: 100 });
 
    for (let i = 0; i < customers.data.length; i++) {
      let str = customers.data[i];
      let valid = true;
      let subs;
      //get the scription object from stripe
      try {
        subs = await stripe.subscriptions.list({
          customer: str.id,
          status: "all",
        });

        subs = subs.data;
      } catch (error) {
        console.log(error);
      }

      let subscriptions = [];

      for (let j = 0; j < subs.length; j++) {
        let data = subs[j];
        let plan = subs[j].items.data[0].plan;

        let planType = "other";
        if (config.basic == plan.product) planType = "basic";
        else if (config.plus == plan.product) planType = "modded";
        else if (config.premium == plan.product) planType = "premium";
        else if (config.max == plan.product) planType = "max";
        else valid = false;

        if (planType != "other") {
          if (data.status == "active") {
            if (data.cancel_at != null) {
              let reason = data.cancellation_details.comment;
              if (reason == null) reason = data.cancellation_details.feedback;
              subscriptions.push(
                planType + ":canceled:" + data.cancel_at + ":" + reason
              );
            } else {
              subscriptions.push(planType + ":active");
            }
          } else if (data.status == "canceled") {
            subscriptions.push(
              planType +
                ":canceled:" +
                data.canceled_at +
                ":" +
                data.cancellation_details.comment
            );
          } else {
            subscriptions.push(
              planType + ":" + data.status + ":" + data.ended_at
            );
          }
        }
      }

      let qua;
      let quaName;
      if (fs.existsSync("accounts/email:" + str.email + ".json")) {
        qua = utils.readJSON("accounts/email:" + str.email + ".json");
      } else {
        let accounts = fs.readdirSync("accounts");
        for (let j in accounts) {
          if (accounts[j].split(":")[0] != "email") {
            let json = utils.readJSON("accounts/" + accounts[j]);
            if (json.email == str.email.toLowerCase()) {
              qua = json;
              quaName = accounts[j];
              break;
            }
          }
        }
      }
      if (qua == undefined) {
        qua = {
          servers: [],
        };
      }
      if (valid && subscriptions.length > 0) {
        let customerData = [
          {
            email: str.email,
            subscriptions: subscriptions,
          },
        ];
        try {
          customerData.push({
            servers: qua.servers,
            id: quaName,
          });
        } catch {}

        data.push(customerData);
      }
    }
    return data;
  } catch (err) {
    console.log(err);
    return null;
  }
}

module.exports = { getCustomerID, checkSubscription, getCreditId, getCustomers };
