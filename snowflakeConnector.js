const csvtojson = require('csvtojson');
const fs = require('fs');
const moment = require('moment');

// const atomicEventsFilePath = 'atomic_recs_data.csv';
// const aepEventsFilePath = 'aep_recs_data.json';

// const atomicEventsFilePath = 'atomic_order_data.csv';
// const aepEventsFilePath = 'aep_order_data.json';

// const atomicEventsFilePath = 'atomic_product_data.csv';
// const aepEventsFilePath = 'aep_product_data.json';

// const atomicEventsFilePath = 'tracked_searches_data.csv';
// const aepEventsFilePath = 'tracked_searches_data.json';

const atomicEventsFilePath = 'web_page_data.csv';
const aepEventsFilePath = 'web_page_data.json';

csvtojson()
  .fromFile(atomicEventsFilePath)
  .then((atomicEvents) => {
    /* IMPORT */
    /* read from atomic events table - all events except for search */
    const aepEvents = atomicEvents.map((atomicEvent) => convertAtomicEventToAEPEvent(atomicEvent));

    /* read from trackes searches */
    /* EXPORT */

    /* write to file option - manually turn on/off */
    fs.writeFileSync(aepEventsFilePath, JSON.stringify(aepEvents, null, 2));

    /* send to AEP option - manually turn on/off*/
    // sendToAEP(aepEvents);

    console.log(`done (${aepEventsFilePath})`);
  })
  .catch((err) => console.error(err));

function convertAtomicEventToAEPEvent(atomicEvent) {
  const aepEvent = {
    commerce: {
      _commerceprojectbeacon: {
        geo_country: atomicEvent.GEO_COUNTRY,
        geo_region: atomicEvent.GEO_REGION,
        geo_city: atomicEvent.GEO_CITY,
        geo_zipcode: atomicEvent.GEO_ZIPCODE,
        geo_latitude: Number(atomicEvent.GEO_LATITUDE),
        geo_longitude: Number(atomicEvent.GEO_LONGITUDE),
        geo_region_name: atomicEvent.GEO_REGION_NAME,
        geo_timezone: atomicEvent.GEO_TIMEZONE,
      },
    },
    _id: atomicEvent.EVENT_ID,
    timestamp: moment(atomicEvent.COLLECTOR_TSTAMP, 'YYYY-MM-DD HH:mm:ss.SSS').toISOString(),
    web: {
      webPageDetails: {
        URL: atomicEvent.PAGE_URL,
      },
      webReferrer: {
        URL: atomicEvent.PAGE_REFERRER,
        type: atomicEvent.REFR_MEDIUM === 'internal' ? 'internal' : 'search_engine',
      }
    },
    identityMap: {
      commerceShopperId: [
        {
          id: atomicEvent.DOMAIN_USERID,
          primary: true
        }
      ]
    }
  };

  /* event type */
  if (atomicEvent.SE_CATEGORY === 'product' && atomicEvent.SE_ACTION === 'view') {
    aepEvent.commerce.productViews = {
      value: 1
    }
  } else if (atomicEvent.SE_CATEGORY === 'product' && atomicEvent.SE_ACTION === 'add-to-cart') {
    aepEvent.commerce.productListAdds = {
      value: 1
    }
  } else if (atomicEvent.SE_CATEGORY === 'recommendation-unit' && atomicEvent.SE_ACTION === 'view') {
    aepEvent.commerce._commerceprojectbeacon.productRecViews = {
      value: 1
    }
  } else if (atomicEvent.SE_ACTION === 'rec-click') {
    aepEvent.commerce._commerceprojectbeacon.productRecClicks = {
      value: 1
    }
  } else if (atomicEvent.SE_ACTION === 'rec-add-to-cart-click') {
    aepEvent.commerce._commerceprojectbeacon.productRecAddToCarts = {
      value: 1
    }
  } else if (atomicEvent.SE_ACTION === 'place-order') {
    aepEvent.commerce.purchases = {
      value: 1,
    }
  } else {
    // assume page view for now
    aepEvent.web.webPageDetails = { value: 1 }
    console.log(`unsupported category/action: ${atomicEvent.SE_CATEGORY}/${atomicEvent.SE_ACTION}`)
  }

  /* product data (AEP productListItems) */
  if (!!atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_PRODUCT_2) {
    // product view, product click, product add to cart
    const product = JSON.parse(atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_PRODUCT_2)[0];
    aepEvent.productListItems = [{
      SKU: product.sku,
      name: product.name,
      productImageUrl: product.mainImageUrl,
      currencyCode: 'USD', // TODO from storefront context
      // TODO categories
    }];
    // console.log(JSON.stringify(aepEvent.productListItems, null, 2));
  } else if (!!atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDED_ITEM_1) {
    // rec click, rec add to cart
    const recommendedProduct = JSON.parse(atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDED_ITEM_1)[0];
    aepEvent.productListItems = [{
      priceTotal: recommendedProduct.prices.minimum.final,
      SKU: recommendedProduct.sku,
      name: recommendedProduct.name,
      productImageUrl: recommendedProduct.imageUrl,
      currencyCode: recommendedProduct.currencyCode,
    }];
  } else if (!!atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_SHOPPING_CART_2) {
    // checkout
    const productList = JSON.parse(atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_SHOPPING_CART_2)[0].items;
    aepEvent.productListItems = productList.map((product) => {
      const aepProduct = {
        priceTotal: product.offerPrice,
        SKU: product.productSku,
        name: product.productName,
        productImageUrl: product.mainImageUrl,
        currencyCode: 'USD', // TODO from storefront context
      }
      return aepProduct;
    });
  }

  /* recs specific data (AEP commerce recs - custom) */
  if (!!atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDATION_UNIT_1) {
    const recommendationUnit = JSON.parse(atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDATION_UNIT_1)[0];
    aepEvent.commerce._commerceprojectbeacon.productRecommendation = {
      id: recommendationUnit.unitId,
      name: recommendationUnit.name,
      type: recommendationUnit.recType,
    }
  }

  return aepEvent;
}
