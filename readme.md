## Insightify

Commerce integartion with CJA.

Export existing data (lifetime) and stream new data from Product Recs and Live Search into CJA.

Build cool CJA dashboards.

### Tools

#### Atomic Events -> AEP Events (Snowflake Connector)

Available event categories:

- web page (page views)
- product (views and add to carts)
- recs (views, clicks, add to carts)
- checkout (orders)

1. get CSV file from ani (ask for specific category)

2. 
```
npm i
```

3.
```
node snowflakeConnector
```

4. output file name printed in console
