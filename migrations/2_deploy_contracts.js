const LockedToken = artifacts.require("./LockedToken.sol");

const BigNumber = require('bignumber.js');
let wei = 1000000000000000000;

module.exports = async function(deployer, network, accounts) {
  web3.utils.toBN(BigNumber(String(1000000000)).times(String(wei)));
  await deployer.deploy(LockedToken, "Hatchtoken", "HATCH", BigNumber(18), web3.utils.toBN(BigNumber(String(1000000000)).times(String(wei))), accounts[1], web3.utils.toBN(BigNumber(String(200000000)).times(String(wei))), web3.utils.toBN(BigNumber(String(13300000)).times(String(wei))));
  let lockedToken = await LockedToken.deployed();
  console.log("LockedToken: " + lockedToken.address);
  console.log("Treasury: " + await lockedToken.treasury());
  console.log("Treasury Unlocked: " + await lockedToken.treasuryUnlocked());
  console.log("Treasury Balance: " + await lockedToken.treasuryBalance());
};
