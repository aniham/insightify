const csvtojson = require('csvtojson');
const fs = require('fs');

const atomicEventsFilePath = 'atomic_recs_data.csv';
const aepEventsFilePath = 'aep_recs_data.json';

const snowflakeToAEPMapping = {
  'EVENT_ID': '_id',
  'DVCE_CREATED_TSTAMP': 'timestamp',
  'SE_CATEGORY': 'category', 
  'SE_ACTION': 'action',  
  'DOMAIN_USERID': 'commerceShopperId',
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
  'CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDATION_UNIT_1': 'recommendation_context',
  'CONTEXTS_COM_ADOBE_MAGENTO_ENTITY_RECOMMENDED_ITEM_1': 'recommended_product',
};

csvtojson()
  .fromFile(atomicEventsFilePath)
  .then((atomicEvents) => {
    const aepEvents = atomicEvents.map((atomicEvent) => convertAtomicEventToAEPEvent(atomicEvent));
    fs.writeFileSync(aepEventsFilePath, JSON.stringify(aepEvents, null, 2));
    console.log('done');
  })
  .catch((err) => console.error(err));

function convertAtomicEventToAEPEvent(record) {
  const aepEvent = {};
  Object.entries(snowflakeToAEPMapping).forEach(([snowflakeField, aepField]) => {
    const snowflakeValue = record[snowflakeField];
    const aepValue = isJsonString(snowflakeValue) ? JSON.parse(snowflakeValue) : snowflakeValue;
    aepEvent[aepField] = aepValue;
  });
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
