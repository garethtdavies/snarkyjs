/*
Description: 

This example described how developers can manipulate the network state of the local blockchain instance.
Changing preconditions might be useful for integration tests, when you want to test your smart contracts behavior in different situations.
For example, you only want your smart contract to initiate a pay out when the `blockchainLength` is at a special height. (lock up period)
*/

import {
  method,
  UInt64,
  PrivateKey,
  SmartContract,
  Mina,
  AccountUpdate,
  isReady,
  Permissions,
  DeployArgs,
  UInt32,
} from 'snarkyjs';

const doProofs = false;

await isReady;

class SimpleZkapp extends SmartContract {
  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      send: Permissions.proofOrSignature(),
    });
    this.balance.addInPlace(UInt64.fromNumber(initialBalance));
  }

  @method blockheightEquals(y: UInt32) {
    let length = this.network.blockchainLength.get();
    this.network.blockchainLength.assertEquals(length);

    length.assertEquals(y);
  }
}

let Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);

// a test account that pays all the fees, and puts additional funds into the zkapp
let feePayer = Local.testAccounts[0].privateKey;

// the zkapp account
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

let initialBalance = 10_000_000_000;
let zkapp = new SimpleZkapp(zkappAddress);

if (doProofs) {
  console.log('compile');
  await SimpleZkapp.compile();
}

console.log('deploy');
let tx = await Mina.transaction(feePayer, () => {
  AccountUpdate.fundNewAccount(feePayer, { initialBalance });
  zkapp.deploy({ zkappKey });
});
await tx.send();

let blockHeight: UInt32 = UInt32.zero;

console.log('assert block height 0');
tx = await Mina.transaction(feePayer, () => {
  // block height starts at 0
  zkapp.blockheightEquals(UInt32.from(blockHeight));
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
await tx.send();

blockHeight = UInt32.from(500);
Local.setBlockchainLength(blockHeight);

console.log('assert block height 500');
tx = await Mina.transaction(feePayer, () => {
  zkapp.blockheightEquals(UInt32.from(blockHeight));
  if (!doProofs) zkapp.sign(zkappKey);
});
if (doProofs) await tx.prove();
await tx.send();

blockHeight = UInt32.from(300);
Local.setBlockchainLength(UInt32.from(5));
console.log('invalid block height precondition');
try {
  tx = await Mina.transaction(feePayer, () => {
    zkapp.blockheightEquals(UInt32.from(blockHeight));
    if (!doProofs) zkapp.sign(zkappKey);
  });
  if (doProofs) await tx.prove();
  await tx.send();
} catch (error) {
  console.log(
    `Expected to fail! block height is ${Local.getNetworkState().blockchainLength.toString()}, but trying to assert ${blockHeight.toString()}`
  );
  console.log(error);
}
