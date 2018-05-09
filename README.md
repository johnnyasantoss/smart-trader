# Smart-Trader

A client to sync your trade orders from your exchanges to **Blockfolio**!

# Supported Exchanges
- Bittrex
- Binance (development)

# How to use

For now the smart-trader only imports your trade orders throught `.csv` files.
After you import all your orders you'll need to run `node index.js`
And _voilà_ the client will start syncing your orders :smiley:
![Sample](images/smart-trader.gif?raw=true "smart-trader.gif")

## Bittrex
 1. Go to your [History](https://bittrex.com/history)
 2. Click in _Download History_ (beside the search in your orders history)
 3. Fill the captcha!
 4. Import it using the python script (`importers/bittrex/importa-historico-bittrex.py`)
    - `./importa-historico-bittrex.py ../../data/fullOrders.csv ../../data/db.sqlite3`

## Binance
 In development :)
