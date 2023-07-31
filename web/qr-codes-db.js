/*
  This file interacts with the app's database and is used by the app's REST APIs.
*/
import path from "path";
import shopify from "./shopify.js";
import express from "express";
import mysql from "mysql2";
import prisma from "./prisma.js";
import { privateDecrypt } from "crypto";


var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "mydb",
});
await prisma.$connect();



con.connect(async function (err) {
  if (err) throw err;
  console.log("Connected!");
});
 
let finddata=await prisma.$executeRawUnsafe(`SELECT * FROM qr_codes`);

console.log("find",finddata);

const hasQrCodesTable = await queryExecuter(
  'SHOW TABLES LIKE "qr_codes";',
  function (err, result) {
    if (err) throw err;
    // console.log("result", result);
  }
);
// console.log("hasQrCodesTable", hasQrCodesTable);

export const QRCodesDB = {
  qrCodesTableName: "qr_codes",
  db: null,
  ready: null,
 
  init: async function () {
    if (hasQrCodesTable) {
      this.ready = Promise.resolve();
      /* Create the QR code table if it hasn't been created */
    } else {
      const createtable = `
    CREATE TABLE ${this.qrCodesTableName} (
        id INTEGER PRIMARY KEY  NOT NULL,   
        shopDomain VARCHAR(511) NOT NULL,
        title VARCHAR(511) NOT NULL,
        productId VARCHAR(255) NOT NULL,
        variantId VARCHAR(255) NOT NULL,
        handle VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        scans INTEGER,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`;

      await __query(createtable, function (err, result) {
        if (err) throw err;
      });
    }
  },

  create: async function ({
    shopDomain,
    title,
    productId,
    variantId,
    handle,
    destination,
  }) {
    const query = `
      INSERT INTO ${this.qrCodesTableName}
      (shopDomain, title, productId , variantId , handle, destination, scans)
      VALUES (?, ?, ?, ?, ?, ?, 0);
    `;
  const rewresult= await prisma.qr_codes.create({data:{shopDomain:shopDomain,title:title,productId:productId,variantId:variantId,handle:handle,destination:destination,scans:0}})

    const rawResults = await this.__query(query, [
      shopDomain,
      title,
      productId,
      variantId,
      handle,
      destination,
    ]);

    console.log("product created",rewresult.id);
    return rawResults.insertId;
  },

  update: async function (
    id,
    { title, productId, variantId, handle, destination }
  ) {
    await this.ready;

    const query = `
        UPDATE ${this.qrCodesTableName}
        SET
          title = ?,
          productId = ?,
          variantId = ?,
          handle = ?,
          destination = ?
        WHERE
          id = ?;
      `;
    // console.log("title",title,"id",id,"prod",productId,"variant",variantId,"dest",destination);
    const updateddata = await prisma.qr_codes.update({where:{id:parseInt(id)},data:{title:title,productId:productId,variantId:variantId,handle:handle,destination:destination}})
    console.log("update data",updateddata);

    await this.__query(query, [
      title,
      productId,
      variantId,
      handle,
      destination,
      id,
    ]);
    return true;
  },

  list: async function (shopDomain) {
    await this.ready;
    const query = `
        SELECT * FROM ${this.qrCodesTableName}
        WHERE shopDomain = ?; `;

  const listdata = await prisma.qr_codes.findMany({where:{shopDomain:shopDomain}})
  console.log("list data",listdata);
 
    const results = await this.__query(query, [shopDomain]);

    return listdata.map((qrcode) => this.__addImageUrl(qrcode));
  },

  read: async function (id) {
    await this.ready;
    const query = `
        SELECT * FROM ${this.qrCodesTableName}
        WHERE id = ?;
      `;
      // console.log("read data");
     const alldata = await prisma.qr_codes.findMany({where:{id:Number(id)}});
console.log("all data",alldata);

    // const rows = await this.__query(query, [id]);
    // if (!Array.isArray(rows) || rows?.length !== 1) return undefined;

    return this.__addImageUrl(alldata[0]);
  },

  delete: async function (id) {
    await this.ready;
    console.log("delete product db");
    const query = `
        DELETE FROM ${this.qrCodesTableName}
        WHERE id = ?;
      `;
const deletedata = await prisma.qr_codes.delete({where:{id:parseInt(id)}})

console.log("delete data",deletedata);    
await this.__query(query, [id]);
    return true;
  },

  /* The destination URL for a QR code is generated at query time */
  generateQrcodeDestinationUrl: function (qrcode) {

    return `${shopify.api.config.hostScheme}://${shopify.api.config.hostName}/qrcodes/${qrcode.id}/scan`;
  },

  /* The behavior when a QR code is scanned */
  handleCodeScan: async function (qrcode) {
    //     /* Log the scan in the database */
    await this.__increaseScanCount(qrcode);

    const url = new URL(qrcode.shopDomain);
    switch (qrcode.destination) {
      //       /* The QR code redirects to the product view */
      case "product":
        return this.__goToProductView(url, qrcode);

      //       /* The QR code redirects to checkout */
      case "checkout":
        return this.__goToProductCheckout(url, qrcode);

      default:
        throw `Unrecognized destination "${qrcode.destination}"`;
    }
  },

  /* Private */
  /*
    Used to check whether to create the database.
    Also used to make sure the database and table are set up before the server starts.
  */
  /* Initializes the connection with the app's sqlite3 database */
  /* Perform a query on the database. Used by the various CRUD methods. */

  __query: function (sql, params = []) {
    return new Promise((resolve, reject) => {
      con.query(sql, params, (err, result) => {
        if (err) {
          console.log("error", err);
          reject(err);
          return;
        }
        console.log("resolve");
        resolve(result);
      });
    });
  },

  __addImageUrl: function (qrcode) {
    try {
      // console.log("add image url",qrcode);
      qrcode.imageUrl = this.__generateQrcodeImageUrl(qrcode);
    } catch (err) {
      console.error(err);
    }
    return qrcode;
  },

  __generateQrcodeImageUrl: function (qrcode) {
    // console.log("generate url",`${shopify.api.config.hostScheme}://${shopify.api.config.hostName}/qrcodes/${qrcode.id}/image`);
    return `${shopify.api.config.hostScheme}://${shopify.api.config.hostName}/qrcodes/${qrcode.id}/image`;
  },

  __increaseScanCount: async function (qrcode) {
    const query = `
      UPDATE ${this.qrCodesTableName}
      SET scans = scans + 1
      WHERE id = ?
    `;
    const countupdate = await prisma.qr_codes.update({data:{scans:{increment :1}},where:{id:parseInt(qrcode.id)}});

    // console.log("update scan count",countupdate);

    await this.__query(query, [qrcode.id]);
  },

  __goToProductView: function (url, qrcode) {
    console.log("product handle", qrcode);
    return productViewURL({
      host: url.toString(),
      productHandle: qrcode.handle,
    });
  },

  __goToProductCheckout: function (url, qrcode) {
    console.log("go to checkout",qrcode);
    return productCheckoutURL({
      host: url.toString(),
      variantId: qrcode.variantId,
      quantity: 1,
    });
  },
};
/* Generate the URL to a product page */
function productViewURL({ host, productHandle }) {
  console.log("product view url", host, "handle", productHandle);
  const url = new URL(host);
  const productPath = `/products/${productHandle}`;
  /* If this QR Code has a discount code, then add it to the URL */
  url.pathname = productPath;
  console.log("url=", url);
  return url.toString();
}

/* Generate the URL to checkout with the product in the cart */
function productCheckoutURL({ host, variantId, quantity }) {
  const url = new URL(host);
  const id = variantId.replace(
    /gid:\/\/shopify\/ProductVariant\/([0-9]+)/,
    "$1"
  );
  /* The cart URL resolves to a checkout URL */
  url.pathname = `/cart/${id}:${quantity}`;
  return url.href;
}

async function queryExecuter(query) {
  return new Promise((resolve, rejects) => {
    con.query(query, (err, res) => {
      if (err) {
        rejects(err);
      }
      resolve(res);
    });
  });
}
