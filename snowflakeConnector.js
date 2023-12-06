const csvtojson = require('csvtojson');
const fs = require('fs');
const moment = require('moment');

const atomicEventsFilePath = 'atomic_recs_data.csv';
const aepEventsFilePath = 'aep_recs_data.json';

const snowflakeToAEPMapping = {
  // 'EVENT_ID': '_id',
  // 'DVCE_CREATED_TSTAMP': 'timestamp',
  // 'SE_CATEGORY': 'category', 
  // 'SE_ACTION': 'action',  
  // 'DOMAIN_USERID': 'commerceShopperId',
  'DOMAIN_SESSIONIDX': 'session',
  'GEO_COUNTRY': 'geo_country',
  'GEO_REGION': 'geo_region',
  'GEO_CITY': 'geo_city',
  'GEO_ZIPCODE': 'geo_zipcode',
  'GEO_LATITUDE': 'geo_latitude',
  'GEO_LONGITUDE': 'geo_longitude',
  'GEO_REGION_NAME': 'geo_region_name',
  'PAGE_URL': 'page_url',
  'PAGE_REFERRER': 'page_referrer',
  'REFR_MEDIUM': 'refr_medium',
  'REFR_SOURCE': 'refr_source',
  'GEO_TIMEZONE': 'geo_timezone',
  // 'CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDATION_UNIT_1': 'recommendation_context',
  // 'CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDED_ITEM_1': 'recommended_product',
};

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
      _commerceprojectbeacon: {},
    },
    _id: atomicEvent.EVENT_ID,
    timestamp: moment(atomicEvent.DVCE_CREATED_TSTAMP, 'YYYY-MM-DD HH:mm:ss.SSS').toISOString(),
    identityMap: {
      commerceShopperId: [
        {
          id: atomicEvent.DOMAIN_USERID,
          primary: true
        }
      ]
    }
  };

  /* 1x1 mapping (diff names) */
  Object.entries(snowflakeToAEPMapping).forEach(([snowflakeField, aepField]) => {
    const snowflakeValue = atomicEvent[snowflakeField];
    const aepValue = isJsonString(snowflakeValue) ? JSON.parse(snowflakeValue) : snowflakeValue;
    aepEvent[aepField] = aepValue;
  });

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

      // TODO add rest of fields
      aepEvent.productListItems = [{
        priceTotal: recommendedProduct.prices.minimum.final,
        sku: recommendedProduct.sku,
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

    // TODO: web data (AEP web schema - must add)
  } 

  return aepEvent;
}

function isJsonString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}
