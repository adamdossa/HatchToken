const LockedToken = artifacts.require("./LockedToken.sol");

const BigNumber = require('bignumber.js');

module.exports = async function(deployer, network, accounts) {
  await deployer.deploy(LockedToken, "Hatchtoken", "HATCH", BigNumber(18), BigNumber(1000000000), accounts[1], BigNumber(200000000), BigNumber(13300000));
  let lockedToken = await LockedToken.deployed();
  console.log("LockedToken: " + lockedToken.address);
  console.log("Treasury: " + await lockedToken.treasury());
  console.log("Treasury Unlocked: " + await lockedToken.treasuryUnlocked());
  console.log("Treasury Balance: " + await lockedToken.treasuryBalance());
};
