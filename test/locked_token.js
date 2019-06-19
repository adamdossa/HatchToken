const HatchToken = artifacts.require("./HatchToken.sol");
const BigNumber = require('bignumber.js');

const PREFIX = "VM Exception while processing transaction: ";
const PREFIX2 = "Returned error: VM Exception while processing transaction: ";

async function tryCatch(promise, message) {
  try {
    await promise;
    throw null;
  } catch (error) {
    assert(error, "Expected an error but did not get one");
    try {
      assert(
        error.message.startsWith(PREFIX + message),
        "Expected an error starting with '" + PREFIX + message + "' but got '" + error.message + "' instead"
      );
    } catch (err) {
      assert(
        error.message.startsWith(PREFIX2 + message),
        "Expected an error starting with '" + PREFIX + message + "' but got '" + error.message + "' instead"
      );
    }
  }
}

async function catchRevert(promise) {
  await tryCatch(promise, "revert");
}

async function advanceBlock() {
  return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        resolve(result.result);
      }
    );
  });
}

// Increases ganache time by the passed duration in seconds
async function increaseTime(duration) {
  await new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
    },
    (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result.result);
    });
  });
  await advanceBlock();
}

contract('HatchToken', function (accounts) {

  // =========================================================================
  it("0. initialize contract", async () => {

    var lockedToken = await HatchToken.new("Spectre Token", "SPC", BigNumber(18), BigNumber(800000000), accounts[1], BigNumber(200000000), BigNumber(10000000), {from: accounts[0]});

    console.log("Token Address: ", lockedToken.address);

    var owner = await lockedToken.owner();
    assert.equal(owner, accounts[0], "owner is set correctly");

    var totalSupply = await lockedToken.totalSupply();
    assert.equal(totalSupply.toNumber(), 800000000, "Initial totalSupply should be 800000000");

    var treasuryBalance = await lockedToken.treasuryBalance();
    assert.equal(treasuryBalance.toNumber(), 800000000, "Initial treasuryBalance should be 800000000");

    var treasuryUnlocked = await lockedToken.treasuryUnlocked();
    assert.equal(treasuryUnlocked.toNumber(), 200000000, "Initial treasuryUnlocked should be 200000000");

  });

  it("1. transfer initial unlocked amounts", async () => {

    var lockedToken = await HatchToken.new("Spectre Token", "SPC", BigNumber(18), BigNumber(800000000), accounts[1], BigNumber(200000000), BigNumber(10000000), {from: accounts[0]});

    // Fail due to no balance
    await catchRevert(lockedToken.transfer(accounts[1], 1, { from: accounts[0] }));

    // Fail due to insufficient unlocked
    await catchRevert(lockedToken.transfer(accounts[2], 200000001, { from: accounts[1] }));

    // Sends some funds
    await lockedToken.transfer(accounts[2], 100000000, { from: accounts[1] });

    assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 100000000, "Unlocked funds");
    assert.equal((await lockedToken.treasuryBalance()).toNumber(), 700000000, "Remaining funds");
    assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 700000000, "Funds sent");
    assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 100000000, "Funds received");

    // Fail due to insufficient unlocked
    await catchRevert(lockedToken.transfer(accounts[3], 100000001, { from: accounts[1] }));

    // Sends some more funds
    await lockedToken.transfer(accounts[3], 100000000, { from: accounts[1] });

    assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 0, "Unlocked funds");
    assert.equal((await lockedToken.treasuryBalance()).toNumber(), 600000000, "Remaining funds");
    assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 600000000, "Funds sent");
    assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 100000000, "Funds received earlier");
    assert.equal((await lockedToken.balanceOf(accounts[3])).toNumber(), 100000000, "Funds received");

    // Fail due to insufficient funds
    await catchRevert(lockedToken.transfer(accounts[3], 1, { from: accounts[1] }));

    // Transfer funds outside of treasury
    await lockedToken.transfer(accounts[4], 100000000, { from: accounts[2] });

  });

  it("2. transfer slowly unlocked amounts", async () => {

    // Start again with a new token
    var lockedToken = await HatchToken.new("Spectre Token", "SPC", BigNumber(18), BigNumber(800000000), accounts[1], BigNumber(200000000), BigNumber(10000000), {from: accounts[0]});

    // Sends some funds
    await lockedToken.transfer(accounts[2], 100000000, { from: accounts[1] });

    assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 100000000, "Unlocked funds");
    assert.equal((await lockedToken.treasuryBalance()).toNumber(), 700000000, "Remaining funds");
    assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 700000000, "Funds sent");
    assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 100000000, "Funds received");

    // Go forward one month from creation
    await increaseTime(60 * 60 * 24 * 30);

    assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 110000000, "Unlocked funds");
    assert.equal((await lockedToken.treasuryBalance()).toNumber(), 700000000, "Remaining funds");
    assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 700000000, "Funds sent");
    assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 100000000, "Funds received");

    // Fail due to insufficient unlocked
    await catchRevert(lockedToken.transfer(accounts[3], 110000001, { from: accounts[1] }));

    // Sends some more funds
    await lockedToken.transfer(accounts[3], 110000000, { from: accounts[1] });

    assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 0, "Unlocked funds");
    assert.equal((await lockedToken.treasuryBalance()).toNumber(), 590000000, "Remaining funds");
    assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 590000000, "Funds sent");
    assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 100000000, "Funds received earlier");
    assert.equal((await lockedToken.balanceOf(accounts[3])).toNumber(), 110000000, "Funds received");

    // Fail due to insufficient funds
    await catchRevert(lockedToken.transfer(accounts[3], 1, { from: accounts[1] }));

    // Transfer funds outside of treasury
    await lockedToken.transfer(accounts[4], 100000000, { from: accounts[2] });

    // Go forward another half-month
    await increaseTime(60 * 60 * 24 * 15);

    assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 0, "Unlocked funds");
    assert.equal((await lockedToken.treasuryBalance()).toNumber(), 590000000, "Remaining funds");

    // Fail due to insufficient funds
    await catchRevert(lockedToken.transfer(accounts[3], 1, { from: accounts[1] }));

    // Go forward another half-month
    await increaseTime(60 * 60 * 24 * 15);

    assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 10000000, "Unlocked funds");
    assert.equal((await lockedToken.treasuryBalance()).toNumber(), 590000000, "Remaining funds");

    // Sends some more funds
    await lockedToken.transfer(accounts[4], 5000000, { from: accounts[1] });

    // Go forward another month
    await increaseTime(60 * 60 * 24 * 30);

    assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 15000000, "Unlocked funds");
    assert.equal((await lockedToken.treasuryBalance()).toNumber(), 585000000, "Remaining funds");

    // Sends some more funds
    await lockedToken.transfer(accounts[4], 15000000, { from: accounts[1] });

    // Fail due to insufficient funds
    await catchRevert(lockedToken.transfer(accounts[3], 1, { from: accounts[1] }));

    // Go forward another half-month
    await increaseTime(60 * 60 * 24 * 15);

    // Change the emission rate - fail due to incorrect account
    await catchRevert(lockedToken.changeMonthlyUnlocked(20000000, {from: accounts[1]}));

    // Change the emission rate
    await lockedToken.changeMonthlyUnlocked(20000000, {from: accounts[0]});

    // Go forward another half-month
    await increaseTime(60 * 60 * 24 * 15);

    assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 20000000, "Unlocked funds");
    assert.equal((await lockedToken.treasuryBalance()).toNumber(), 570000000, "Remaining funds");

    // Sends some more funds
    await lockedToken.transfer(accounts[4], 20000000, { from: accounts[1] });

    // Fail due to insufficient funds
    await catchRevert(lockedToken.transfer(accounts[3], 1, { from: accounts[1] }));

  });

  it("3. multi-month unlock", async () => {

      // Start again with a new token
      var lockedToken = await HatchToken.new("Spectre Token", "SPC", BigNumber(18), BigNumber(1000000000), accounts[1], BigNumber(200000000), BigNumber(13300000), {from: accounts[0]});

      // Sends some funds
      await lockedToken.transfer(accounts[2], 100000000, { from: accounts[1] });

      assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 100000000, "Unlocked funds");
      assert.equal((await lockedToken.treasuryBalance()).toNumber(), 900000000, "Remaining funds");
      assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 900000000, "Funds sent");
      assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 100000000, "Funds received");

      // Go forward two months from creation
      await increaseTime(60 * 60 * 24 * 60);

      assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 100000000 + 2*13300000, "Unlocked funds");
      assert.equal((await lockedToken.treasuryBalance()).toNumber(), 900000000, "Remaining funds");
      assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 900000000, "Funds sent");
      assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 100000000, "Funds received");

      // Fail due to insufficient unlocked
      await catchRevert(lockedToken.transfer(accounts[3], 126600001, { from: accounts[1] }));

      // Sends some more funds
      await lockedToken.transfer(accounts[3], 126600000, { from: accounts[1] });

      assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 0, "Unlocked funds");
      assert.equal((await lockedToken.treasuryBalance()).toNumber(), 773400000, "Remaining funds");
      assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 773400000, "Funds sent");
      assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 100000000, "Funds received earlier");
      assert.equal((await lockedToken.balanceOf(accounts[3])).toNumber(), 126600000, "Funds received");

      // Fail due to insufficient funds
      await catchRevert(lockedToken.transfer(accounts[3], 1, { from: accounts[1] }));

      // Use emergency unlock to unlock additional funds immediately
      // Fail due to wrong caller
      await catchRevert(lockedToken.emergencyUnlock(10, {from: accounts[1]}));

      // Succeed
      await lockedToken.emergencyUnlock(10, {from: accounts[0]});

      // Fail due to insufficient unlocked amount
      await catchRevert(lockedToken.transfer(accounts[3], 11, { from: accounts[1] }));
      await lockedToken.transfer(accounts[5], 10, { from: accounts[1] });

      // Transfer funds back to treasury
      await lockedToken.transfer(accounts[1], 100000000, { from: accounts[2] });


      assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 100000000, "Unlocked funds");
      assert.equal((await lockedToken.treasuryBalance()).toNumber(), 873399990, "Remaining funds");
      assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 873399990, "Funds sent");
      assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 0, "Funds received earlier");
      assert.equal((await lockedToken.balanceOf(accounts[3])).toNumber(), 126600000, "Funds received");

      // Able to send transferred funds
      await lockedToken.transfer(accounts[2], 50000000, { from: accounts[1] });

      assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 50000000, "Unlocked funds");
      assert.equal((await lockedToken.treasuryBalance()).toNumber(), 823399990, "Remaining funds");
      assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 823399990, "Funds sent");
      assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 50000000, "Funds received earlier");
      assert.equal((await lockedToken.balanceOf(accounts[3])).toNumber(), 126600000, "Funds received");

      // Skip 6 months Forward
      await increaseTime(60 * 60 * 24 * 30 * 6);

      assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 129800000, "Unlocked funds");
      assert.equal((await lockedToken.treasuryBalance()).toNumber(), 823399990, "Remaining funds");
      assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 823399990, "Funds sent");
      assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 50000000, "Funds received earlier");
      assert.equal((await lockedToken.balanceOf(accounts[3])).toNumber(), 126600000, "Funds received");

      // Transfer funds - fail insufficient funds
      await catchRevert(lockedToken.transfer(accounts[2], 129800001, { from: accounts[1] }));

      // Transfer funds
      await lockedToken.transfer(accounts[2], 129800000, { from: accounts[1] });

      assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 0, "Unlocked funds");
      assert.equal((await lockedToken.treasuryBalance()).toNumber(), 693599990, "Remaining funds");
      assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 693599990, "Funds sent");
      assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 179800000, "Funds received earlier");
      assert.equal((await lockedToken.balanceOf(accounts[3])).toNumber(), 126600000, "Funds received");

      // Go forward until all funds are unlocked
      await increaseTime(60 * 60 * 24 * 30 * 200);
      assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 1000000000, "Unlocked funds");
      assert.equal((await lockedToken.treasuryBalance()).toNumber(), 693599990, "Remaining funds");
      assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 693599990, "Funds sent");
      assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 179800000, "Funds received earlier");
      assert.equal((await lockedToken.balanceOf(accounts[3])).toNumber(), 126600000, "Funds received");

      // Transfer funds
      await lockedToken.transfer(accounts[2], 693599990, { from: accounts[1] });

      assert.equal((await lockedToken.treasuryUnlocked()).toNumber(), 1000000000, "Unlocked funds");
      assert.equal((await lockedToken.treasuryBalance()).toNumber(), 0, "Remaining funds");
      assert.equal((await lockedToken.balanceOf(accounts[1])).toNumber(), 0, "Funds sent");
      assert.equal((await lockedToken.balanceOf(accounts[2])).toNumber(), 873399990, "Funds received earlier");
      assert.equal((await lockedToken.balanceOf(accounts[3])).toNumber(), 126600000, "Funds received");

      // Receive some funds back to treasury
      await lockedToken.transfer(accounts[1], 100000000, { from: accounts[2] });

      // Transfer them back out
      await lockedToken.transfer(accounts[2], 100000000, { from: accounts[1] });


  });

});
