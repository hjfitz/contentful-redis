# Redis Cache for Contentful
> Redis cache for Contentful, built using the Sync API. 

Contentful is a fantastic tool. It has a great API and fantastic SDKs. The only issue with it is that API responses can take up to 750ms!

Caching all of your entries on your server means that not only do you have a quicker API response - you've also got a contentful backup on your server!

## Features
* Uses Sync API
  * The preview API isn't supported by the Sync API! Delivery only.
* Resolves deep contentful links on sync
* On next sync, links are also resolved!

## Prerequisites
* Contentful Space/Access keys
* A redis server

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

## Debugging
Run your server with `DEBUG=contentful-redis node $app`