/* eslint-disable */
const Wrapper = require('./src');
const log = require('./src/logger')('[TEST]');

const testWrapper = new Wrapper({
  space: 'w4av3iw5muqd',
  accessToken: 'f839d7b70095f38c739fd8a759300fc9da3d4175ea77cd7ad7931cf617beb831',
});

const singleLevel1 = '1yzDPQhOT2GCCaOSekksee';
const level1 = '4QGBDFjIhGAC0CSOW2QgC4';
const level2 = '4s4iIxjkMMECMg4wkMag42';
const level3 = '5IzpeCscCWYc00uy6MqwUe';


const testAll = async () => {
  log('Getting all');
  const all = await testWrapper.getEntries();
  // console.log(all);
};

const testSingle = async () => {
  // test getting a top level entry
  log('Getting item');
  const topLevel = await testWrapper.getEntry({ id: singleLevel1 });
  log('item GET');
  console.log(topLevel);
  const topLevelManyRef = await testWrapper.getEntry({ id: level1 });
  const midLevel = await testWrapper.getEntry({ id: level2 });
  const bottomLevel = await testWrapper.getEntry({ id: level3 });
  console.log(bottomLevel);
};

const testMany = async () => {
  const many = await testWrapper.getEntries([level1, level2]);
  console.log(many);
}

const main = async () => {
  // first, sync. This is because we can't do it in the constructor
  log('Syncing');
  // await testWrapper.sync();
  // await testAll();
  // await testSingle();
  await testMany();
};

main();
