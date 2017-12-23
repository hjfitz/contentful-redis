# Redis Cache for Contentful
Redis cache for Contentful, built using the Sync API. 
By default, this library resolves all links to the deepest level by default. 

## Usage
You'll need a redis store running.

#### Create the wrapper
This has a syntax similar to the original Contentful JS client.
```js
const Contentful = require('contentful-redis');
const client = new Contentful({
  accessToken: '', // your contentful access token
  space: '', // your contentful space
  host: '', // Optional - where your redis client is hosted
  port: '', // the port for the redis client
});
```

#### Getting entries
Calling either of the methods invokes a sync. This checks to see if there are new entries. If there are, they're stored and returned to you.

There are two methods. Both return are async (and thus return a promise).
```js
const storedEntry = await client.getEntry({ id: 'hfjhkjahdajhkjkshf' });
console.log(storedEntry); // just the one entry
```

To get a list of entries:
```js
const IDs = ['fdsffdsfdsasaf','jgjfjkhjkjkhjkhjkyuj','gfhtrerhtrytyutr'];
const entries = await client.getEntries(IDs);
console.log(entries); // Array(3)
```

To get all entries:
```js
const allEntries = await client.getEntries();
console.log(allEntries); // EVERYTHING stored in redis
```

## Motivation 
Having used Contentful in production, I'd noticed that performance can be less than ideal - sometimes taking up to 500ms for a request! (That is, client -> server -> contentful -> server -> client). Moving this to a key-value store significantly improves performance (benchmarks to come soon). It also provides an extra level of redundancy.

## Todo
* ~~storage in redis~~
* ~~basic addition and deletion via sync api~~
* ~~link handling~~
* ~~link handling for multiple locales~~
* ~~handling of deep references~~
* Testing