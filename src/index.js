//@ts-check

const console = require('console');
const Blockfolio = require('blockfolio-api-client');
const sqlite3 = require('sqlite3').verbose();
const yaml = require('js-yaml');
const fs = require('fs');
const groupBy = require('group-by');
const Multispinner = require('multispinner');
const async = require('async');

const DATABASE_FILE = './data/db.sqlite3';
const CONFIG_FILE = './data/config.yaml';

/**
 * Fetches all the info from sqlite database
 * @param {Function} callback callback function callback(orders: [])
 */
function getInfoFromSqlite(callback) {
    if (!callback)
        throw Error('Missing callback');

    let db = new sqlite3.Database(DATABASE_FILE, sqlite3.OPEN_READWRITE, function (err) {
        if (err) {
            quit(err.message);
        }
        console.log('Connected to the "' + DATABASE_FILE + '" database file.');
        console.log('Fetching orders...');

        db.all(
            'SELECT Id, Exchange, Pair, Type, Quantity, `Limit`, CommissionPaid, OpenDate, CloseDate FROM `Orders`' +
            ' WHERE CloseDate NOT NULL' +
            ' ORDER BY Pair, OpenDate, Type'
            , function (err, rows) {
                if (err) quit(err.message);
                callback(rows);
            }
        );
    });
}

/**
 * Gets the configuration from the YAML config file
 * @see CONFIG_FILE config file path
 * @returns {{token:string}}
 */
function getConfiguration() {
    var config = {
        token: ''
    };

    try {
        return yaml.safeLoad(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
        quit(e);
    }

    return config;
}

/**
 * Send all info to Blockfolio
 * @param {[any]} orders Orders array
 * @param {{token:string,locale:string,fiat_currency:string}} config Configuration object
 * @see CONFIG_FILE to setup your own config file
 */
function sendInfoToBlockfolio(orders, config, callback) {
    if (typeof orders !== typeof ([]))
        throw Error('orders should be an array!');

    if (!orders)
        quit('Nothing to import.');
    if (!config)
        quit('Missing configuration.');

    Blockfolio.init(config.token, function () {
        console.log('Grouping all the info by pairs...');
        let ordersByPairs = groupBy(orders, 'Pair');
        let pairs = [];

        for (const key in ordersByPairs) {
            pairs.push(key);
        }

        const m = new Multispinner(pairs, {
            postText: 'Synchronizing...'
        });

        let sendQueue = async.queue(
            function (position, queueCallback) {
                if (!position)
                    queueCallback(new Error('Invalid pair'));

                Blockfolio.addPosition(position.originalPair, position, function (err) {
                    if (err) {
                        m.error(position.originalPair);
                        queueCallback(err);
                        return;
                    }
                    m.success(position.originalPair);
                    queueCallback();
                });
            }
            , 1
        );

        let conversionQueue = async.queue(
            function (pair, queueCallback) {
                if (!ordersByPairs.hasOwnProperty(pair))
                    queueCallback(Error('Invalid pair'));

                const ordersByPair = ordersByPairs[pair];

                generateOrders(pair, ordersByPair, function (err, positions) {
                    if (positions === true) {
                        m.success(pair);
                    } else if (positions) {
                        positions.forEach(position => {
                            position.originalPair = pair;
                        });
                        sendQueue.push(positions);
                    }
                    queueCallback(err);
                });
            }
            , 4
        );

        conversionQueue.push(
            Object.keys(ordersByPairs)
            , function (err) {
                if (err)
                    quit(err);
            }
        );
    });
}

/**
 * 
 * @param {string} pair Pair info
 * @param {[any]} ordersByPair 
 * @param {Function} callback Callback
 */
function generateOrders(pair, ordersByPair, callback) {
    Blockfolio.getPositions({ pair }, function (err, positions) {
        if (err)
            callback(err);

        let ordersMissingOnBlockfolio = mapMissingOrders(positions, ordersByPair);

        if (!ordersMissingOnBlockfolio || ordersMissingOnBlockfolio.length === 0) {
            callback(null, true);
            return;
        }

        let blockfolioPositions = ordersMissingOnBlockfolio.map(function (order) {
            return {
                mode: (order.Type === 1) ? 'buy' : 'sell',
                exchange: order.Exchange.toLowerCase(),
                price: order.Limit,
                amount: order.Quantity,
                timestamp: new Date(order.CloseDate).getTime(),
                note: 'Imported using smart-trader\n' +
                    order.Id
            };
        });

        callback(null, blockfolioPositions);
    });
}

function mapMissingOrders(positions, ordersByPair) {
    positions = positions.filter(function (p) {
        return p.watch === 0;
    });

    const ordersMissingOnBlockfolio = ordersByPair.filter(function (o) {
        let found = positions.filter(function (p) {
            return p.exchange === o.Exchange
                && `${p.base}-${p.coin}` === o.Pair
                && p.price === o.Limit
                && Math.abs(p.quantity) === o.Quantity
                && (p.quantity > 0 ? 1 : 2) === o.Type;
        });
        return found.length === 0;
    });

    return ordersMissingOnBlockfolio;
}

/**
 * Exits the program showing on last message
 * @param {string} msg Error message
 */
function quit(msg) {
    if (msg)
        console.error(msg);
    process.exit(1);
}

function main() {
    const CONFIG = getConfiguration();

    if (!('token' in CONFIG) || !CONFIG.token)
        quit('Missing token in "' + CONFIG_FILE + '".');
    if (!('locale' in CONFIG) || !CONFIG.locale)
        CONFIG['locale'] = 'en-US';
    if (!('fiat_currency' in CONFIG) || !CONFIG.fiat_currency)
        CONFIG['fiat_currency'] = 'usd';

    getInfoFromSqlite(function (orders) {
        sendInfoToBlockfolio(
            orders
            , CONFIG
            , function (err) {
                if (err)
                    quit(err);

                process.exit(0);
            }
        );
    });
}

module.exports = main;
