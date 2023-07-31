/*
  The custom REST API to support the app frontend.
  Handlers combine application data from qr-codes-db.js with helpers to merge the Shopify GraphQL Admin API data.
  The Shop is the Shop that the current user belongs to. For example, the shop that is using the app.
  This information is retrieved from the Authorization header, which is decoded from the request.
  The authorization header is added by App Bridge in the frontend code.
*/
import express from "express";
import shopify from "../shopify.js";
import { QRCodesDB } from "../qr-codes-db.js";
import {
  getQrCodeOr404,
  getShopUrlFromSession,  
  parseQrCodeBody,
  formatQrCodeResponse,
} from "../helpers/qr-codes.js";

const SHOP_DATA_QUERY = `
{
  shop {
    url
  }
}
`;

export default function applyQrCodeApiEndpoints(app) {
  app.use(express.json());

  app.get("/api/shop-data", async(req, res) => {
    const client = new shopify.api.clients.Graphql({
      session: res.locals.shopify.session,
    });
    /* Fetch shop data, including all available discounts to list in the QR code form */
    const shopData = await client.query({
      data: {
        query: SHOP_DATA_QUERY,
        variables: {
          first: 25,
        },
      },
    });
    // console.log("send data");
    res.send(shopData.body.data);
  });

  app.post("/api/qrcodes", async (req, res) => {
    try {
      const id = await QRCodesDB.create({
        shopDomain: `${await getShopUrlFromSession(req, res)}`,
      ...(await parseQrCodeBody(req))
        /* Get the shop from the authorization header to prevent users from spoofing the data */
      }); 
      // console.log("data");
      const response = await formatQrCodeResponse(req, res, [
        await QRCodesDB.read(id),
      ]);
      console.log("response in api's",response[0]);
      res.status(201).send(response[0]);
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.patch("/api/qrcodes/:id", async (req, res) => {
    const qrcode = await getQrCodeOr404(req, res);

    if (qrcode) {
      try {
        // console.log("update api");
        await QRCodesDB.update(req.params.id, await parseQrCodeBody(req));
        const response = await formatQrCodeResponse(req, res, [
          await QRCodesDB.read(req.params.id),
        ]);
        console.log("read data in update",response[0]);
        res.status(200).send(response[0]);
      } catch (error) {
        console.log("read data else");

        res.status(500).send(error.message);
      }
    }
  });

  app.get("/api/qrcodes", async (req, res) => {
    try {
      const rawCodeData = await QRCodesDB.list(
        await getShopUrlFromSession(req, res)
      );

      const response = await formatQrCodeResponse(req, res, rawCodeData);
      res.status(200).send(response);
    } catch (error) {
      console.error(error);
      res.status(500).send(error.message);
    }
  });

  app.get("/api/qrcodes/:id", async (req, res) => {
    const qrcode = await getQrCodeOr404(req, res);
// console.log("this this this",qrcode);
    if (qrcode) {
      const formattedQrCode = await formatQrCodeResponse(req, res, [qrcode]);
      res.status(200).send(formattedQrCode[0]);
    }
  });

  app.delete("/api/qrcodes/:id", async (req, res) => {
    console.log("delete ");
    const qrcode = await getQrCodeOr404(req, res);

    if (qrcode) {
      await QRCodesDB.delete(req.params.id);
      res.status(200).send();
    }
  });
}

