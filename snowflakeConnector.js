const csvtojson = require('csvtojson');
const fs = require('fs');
const moment = require('moment');

const atomicEventsFilePath = 'atomic_recs_data.csv';
const aepEventsFilePath = 'aep_recs_data.json';

csvtojson()
  .fromFile(atomicEventsFilePath)
  .then((atomicEvents) => {
    const aepEvents = atomicEvents.map((atomicEvent) => convertAtomicEventToAEPEvent(atomicEvent));
    fs.writeFileSync(aepEventsFilePath, JSON.stringify(aepEvents, null, 2));
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
    timestamp: moment(atomicEvent.DVCE_CREATED_TSTAMP, 'YYYY-MM-DD HH:mm:ss.SSS').toISOString(),
        // TODO: web data (AEP web schema - must add)
    web: {
      webPageDetails: {
        URL: atomicEvent.PAGE_URL,
      },
      webReferrer: {
        URL: atomicEvent.PAGE_REFERRER,
        type: atomicEvent.REFR_MEDIUM,
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

  /* special cases */
  if (atomicEvent.SE_CATEGORY === 'recommendation-unit') { // all events are recommendation-units for now

    // event type (AEP commerce actions)
    if (atomicEvent.SE_ACTION === 'view') {
      aepEvent.commerce._commerceprojectbeacon.productRecViews = {
        value: 1
      }
    }
    else if (atomicEvent.SE_ACTION === 'rec-click') {
      aepEvent.commerce._commerceprojectbeacon.productRecClicks = {
        value: 1
      }
    }
    else if (atomicEvent.SE_ACTION === 'rec-add-to-cart-click') {
      aepEvent.commerce._commerceprojectbeacon.productRecAddToCarts = {
        value: 1
      }
    }    

    // product data (AEP productListItems)
    if (!!atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDED_ITEM_1) {
      // product data for views will be different - this assumes single product in event which is fine for cliks/adds
      const recommendedProduct = JSON.parse(atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDED_ITEM_1)[0];

      aepEvent.productListItems = [{
        priceTotal: recommendedProduct.prices.minimum.final,
        SKU: recommendedProduct.sku,
        name: recommendedProduct.name,
        productImageUrl: recommendedProduct.imageUrl,
        currencyCode: recommendedProduct.currencyCode,
      }];
    }

    // recs specific data (AEP commerce recs - custom)
    if (!!atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDATION_UNIT_1) {
      const recommendationUnit = JSON.parse(atomicEvent.CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDATION_UNIT_1)[0];
      aepEvent.commerce._commerceprojectbeacon.productRecommendation = {
        id: recommendationUnit.unitId,
        name: recommendationUnit.name,
        type: recommendationUnit.recType,
      }
    }
  } 

  return aepEvent;
}
