require('dotenv').config()
const HDWalletProvider = require('truffle-hdwallet-provider')

const {
  PRIVATE_KEY,
  MNEMONIC,
  INFURA_API_KEY
} = process.env

module.exports = {
  networks: {
    mainnet: {
      provider: () => new HDWalletProvider(MNEMONIC || PRIVATE_KEY, `https://mainnet.infura.io/v3/${INFURA_API_KEY}`),
      network_id: 1,
      gas: 7000000
    },
    local: {
      provider: () => new HDWalletProvider(MNEMONIC || PRIVATE_KEY, `http://127.0.0.1:8545`),
      network_id: 999,
      gas: 10000000
    },
    test: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
      gas: 10000000
    }
  },
  compilers: {
    solc: {
      version: '0.5.2',
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions: {
      currency: 'USD',
      gasPrice: 1
    }
  }
}
