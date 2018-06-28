// ==UserScript==
// @name         FCoin Helper
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  Add total amount for FCoin exchnage finance
// @supportURL   https://github.com/yanghuan/FCoin-Helper/issues
// @author       YANG Huan
// @match        https://exchange.fcoin.com/*
// @require      https://cdn.bootcss.com/jquery/1.8.3/jquery.min.js
// @grant        none
// @contributionURL    https://github.com/yanghuan/FCoin-Helper#crypto
// ==/UserScript==

(function() {
    'use strict';
    var tokens = [];
    var curPrices = {};
    var cnyRate = null;
    function isFinancePage() {
        return document.URL == "https://exchange.fcoin.com/finance";
    }
    function getBalanceTokens() {
        let rts =  $(".rt-tbody");
        let trs = rts.children(".rt-tr-group");
        let tokens = [];
        for (let i = 0; i < trs.length; ++i) {
            let tr = trs[i];
            let tds = $(tr).find(".rt-td");
            let symbol = $(tds[0]).children().text();
            let count = $(tds[1]).children().text();
            let available = $(tds[2]).children().text();
            tokens.push({ "symbol": symbol, "count": count, "available": available });
        }
        return tokens;
    }
    function check() {
        if (isFinancePage()) {
            tokens = getBalanceTokens();
            if (tokens.length > 0) {
                let lis = $("[role='tab']");
                for (let i = 1; i < lis.length; ++i) {
                    lis[i].click();
                    let curTolens = getBalanceTokens();
                    if (curTolens.length > 0) {
                        tokens = tokens.concat(curTolens);
                    }
                }
                lis[0].click();
                getPricesFromWebSocket();
            }
            else {
                registerCheck();
            }
        }
        else
        {
            registerCheck();
        }
    }
    function registerCheck(time) {
        setTimeout(check, time || 1000);
    }
    function checkCNYRate() {
        let server = $(".Dropdown-placeholder").text();
        if (server == "简体中文") {
            $.getJSON("https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20json%20where%20url%20%3D%20%22https%3A%2F%2Fwww.fcoin.com%2Fapi%2Fcommon%2Fget_rate%22&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys", function (data) {
              let rate = data.query.results.json.data;
              cnyRate = parseFloat(rate);
            });
        }
    }
    function getPricesFromWebSocket() {
        let webSocket = new WebSocket("wss://ws.fcoin.com/api/v2/ws");
        webSocket.binaryType = "arraybuffer";
        webSocket.onopen = function(event){
            console.log(("webSocket connect at time: "+new Date()));
            var sub_tickers = {
                "id":'tickers',
                "cmd": "sub",
                "args": ['all-tickers']
            };
            webSocket.send(JSON.stringify(sub_tickers));
        };
        webSocket.onmessage = function(event){
            let raw_data = event.data;
            let data = JSON.parse(raw_data);
            if (data.topic == 'all-tickers') {
                if (data.tickers.length > 0) {
                    for (let i = 0; i < data.tickers.length; i++) {
                        let ticker = data.tickers[i];
                        let symbol = ticker.symbol;
                        let price = ticker.ticker[0];
                        if (symbol == "ethusdt") {
                            if (price != null) {
                              curPrices.eth = price;
                            }
                        }
                        else if (symbol == "btcusdt") {
                            if (price != null) {
                              curPrices.btc = price;
                            }
                        }
                        else if (symbol == "ftusdt") {
                            if (price != null) {
                              curPrices.ft = price;
                            }
                        }
                        updatePrice(symbol, price);
                    }
                }
            }
        };
        webSocket.onclose = function() {
            console.log("webSocket connect is closed");
            console.log(arguments);
            getPricesFromWebSocket();
        };
        webSocket.onerror = function(){
            console.log("error");
            console.log(arguments);
            getPricesFromWebSocket();
        };
        setInterval(function () {
            webSocket.send(JSON.stringify({"cmd": "ping","args":[ Date.parse(new Date())]}));
        }, 40000);
    }
    function spiltSymbol(symbol) {
        let len = symbol.length;
        let last = symbol[len - 1];
        let token, price;
        if (last == "c") {
            token = symbol.substr(0, len - 3);
            price = "btc";
        }
        else if (last == "h") {
            token = symbol.substr(0, len - 3);
            price = "eth";
        }
        else if (last == "t") {
            let prevLast = symbol[len - 2];
            if (prevLast == "d") {
                token = symbol.substr(0, len - 4);
                price = "usdt";
            }
            else {
                token = symbol.substr(0, len - 2);
                price = "ft";
            }
        }
        return [token, price];
    }
    function updatePrice(symbol, price) {
        let a = spiltSymbol(symbol);
        let token = a[0];
        let priceToken = a[1];
        let info = tokens.find(i => i.symbol == token);
        if (info != null) {
            info["@" + priceToken] = price;
            update();
        }
        else {
            console.warn(`${token} is not found in finance`);
        }
    }
    function getPriceOfUSDT(t) {
        if (t.symbol == "usdt") {
            return 1;
        }
        let usdt = t["@usdt"];
        if (usdt != null) {
            return usdt;
        }
        let btc = t["@btc"];
        if (btc != null) {
            return btc * curPrices.btc;
        }
        let eth = t["@eth"];
        if (eth != null) {
            return eth * curPrices.eth;
        }
        let ft = t["@ft"];
        if (ft != null) {
            return ft * curPrices.ft;
        }
        return null;
    }
    function getTotalUSDT() {
        let total = 0;
        for (let i = 0; i < tokens.length; ++i) {
            let t = tokens[i];
            let p = getPriceOfUSDT(t);
            if (p == null) {
              return null;
            }
            let money = parseFloat(t.count) * p;
            total += money;
        }
        return total;
    }
    function show(datas) {
        let infoString = datas.join("/ ");
        let capital = $(".fzPqWC");
        let span = capital.children("span");
        let next = span.children("span");
        if (next.length > 0) {
            next.html(infoString);
        }
        else {
            span.append(`<span>${infoString}</span>`);
        }
    }
    function update() {
        let datas = []
        let usdt = getTotalUSDT();
        if (usdt != null) {
          if (cnyRate != null) {
              let cny = usdt * cnyRate;
              let cnyString = `${cny.toFixed(2)} cny`;
              datas.push(cnyString);
          }
          let usdtString = `${usdt.toFixed(2)} usdt`;
          datas.push(usdtString);
          let btcString = `${(usdt / curPrices.btc).toFixed(4)} btc`;
          datas.push(btcString);
          let ethString = `${(usdt / curPrices.eth).toFixed(4)} eth`;
          datas.push(ethString);
          show(datas);
        }
    }
    $(function () {
        //debugger;
        checkCNYRate();
        registerCheck();
    });
})();
